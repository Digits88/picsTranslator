// initialize http
var express = require('express');
var app = express();

// initialize google translate
const translate = require('google-translate-api');


// initialize the noun project
var NounProject = require('the-noun-project'),
    nounProject = new NounProject({
        key: '4c1e778c37bc49bd84d2da9431b762a4',
        secret: '72bc79d025c34ac1838529a78bf8a5b1'
    });


// the actual functions
let translationCache = {};
function translateText(text, lang, callback) {
    let key = text + lang;
    if (!(key in translationCache)) {
        translate(text, {to: "en", from: lang}).then(translateResut => {
            translationCache[key] = {ok: translateResut.text};
            callback(translationCache[key]);
        }).catch(err => {
            translationCache[key] = {err: err};
            callback(translationCache[key]);
        });
    } else {
        console.log("cache hit!");
        callback(translationCache[key]);
    }
}

function isIconCnadidate(word) {
    const blacklist = ["it", "and", "because"];
    if(!word) {
        return false;
    } else if (word.length < 3) {
        return false;
    } else if (blacklist.indexOf(word.toLowerCase().trim()) !== -1) {
        return false;
    } else {
        return true;
    }
}

let iconCache = {};
function getIcon(text, lang, callback) {
    let key = text + lang;
    translateText(text, lang, translateResult => {
        if (translateResult.ok && isIconCnadidate(translateResult.ok)) {
            if (!(key in iconCache)) {
                nounProject.getIconsByTerm(translateResult.ok, {limit: 50}, (err, data) => {
                    try {
                        console.log(data)
                        let icon = data["icons"].filter(icon => icon.collectios !== [] && icon.license_description !== 'public-domain' && icon.term.toLowerCase() === translateResult.ok.toLowerCase())[0].preview_url;
                        if(!icon) throw "icon isnt :(";
                        console.log(icon);
                        iconCache[key] = {ok: icon};
                        callback(iconCache[key]);
                    } catch (e) {
                        console.log(e);
                        iconCache[key] = {err: e};
                        callback(iconCache[key]);
                    }
                });
            } else {
                console.log("cache hit!");
                callback(iconCache[key]);
            }
        } else {
            iconCache[key] = {err: translateResult.err};
            callback(iconCache[key]);
        }
    });
}

function textToWordIconsObject(text, lang, callback) {
    let words = text
        .split(/[\s,\.]/)
        .map(s => s.replace(/[\s,\.]/g, ""))
        .map(s => s.toLowerCase())
        .filter((s, pos, list) => list.indexOf(s) === pos);

    let icons = {};
    let lastFinished = [];

    words.forEach((word, index, list) => {
        getIcon(word, lang, res => {
            if (res.ok) {
                icons[word] = res.ok;
            }

            lastFinished.push(word);
            if (lastFinished.length === list.length) {
                callback({ok: icons})
            }
        });
    });
}

function textToIconText(text, lang, callback) {
    textToWordIconsObject(text, lang, res => {
        if (res.ok) {
            Object.keys(res.ok).forEach(key => {
                text = text.replace(new RegExp("\\b" + key + "\\b", "gim"), "<img src='" + res.ok[key] + "'>")
            });

            header = "<meta charset='UTF-8'><style>img{height: 50px; position: relative; bottom: -5px;} body {font-size: 50px; line-height: 65px;}</style>";

            callback({ok: header + text});
        }
    });
}

// the routing
registerUrlForCallbackFunction("/api/translate", translateText);
registerUrlForCallbackFunction("/api/icon", getIcon);
registerUrlForCallbackFunction("/api/wordIcons", textToWordIconsObject);
registerUrlForCallbackFunction("/api/iconText", textToIconText);


app.listen(8080, "0.0.0.0");

// util functions
function registerUrlForCallbackFunction(url, callbackFunction) {
    app.get(url, (request, response) => {
        let text = decodeURIComponent(request.query.text);
        console.log(text);
        let lang = decodeURIComponent(request.query.lang);

        callbackFunction(text, lang, res => {
            if (res.ok) {
                response.send(res.ok)
            } else {
                response.status(404);
                response.send(res.err);
            }
        });
    });
}
