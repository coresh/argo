"use strict";

const os = require("os");
const dns = require("dns");
const util = require("util");

exports.log = log;
exports.request = request;
exports.getIP = getIP;

function log(...args) {
    const now = new Date().toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });

    console.log(now, ...args); // eslint-disable-line no-console
}

const urlParse = require("url").parse;
const https = require("https");
const http = require("http");
const querystring = require("querystring");
const EventEmitter = require("events");
const HttpsProxyAgent = require("https-proxy-agent");

function request({
    url = "",
    method = "GET",
    headers = {},
    body = null,
    qs = {}
} = {}, callback = (err = null, response = null, rawData = null) => { // eslint-disable-line no-unused-vars
    log("request method requires a callback");
}) {
    const ee = new EventEmitter();
    const reqUrl = urlParse(url);
    const isHttps = reqUrl.protocol === "https:";
    const host = reqUrl.hostname;
    const port = reqUrl.port || (isHttps ? 443 : 80);

    let path = reqUrl.path;

    if (method === "GET" && Object.keys(qs).length) {
        path += `?${querystring.stringify(qs)}`;
    }

    if (body) {
        headers["Content-Type"] = "application/json";
        headers["Content-Length"] = JSON.stringify(body).length;
    }

    const requestOptions = {
        host,
        port,
        path,
        method,
        headers
    };

    function requestResponse(res) {
        ee.emit("response");

        res.setEncoding("utf8");

        let rawData = "";

        res.on("data", chunk => {
            ee.emit("data", chunk);

            rawData += chunk;
        });

        res.on("end", () => {
            if (typeof callback === "function") {
                callback(null, res, rawData); // eslint-disable-line callback-return
            } else {
                log(callback);
            }
        });
    }

    if (process.env.https_proxy) {
        requestOptions.agent = new HttpsProxyAgent(process.env.https_proxy);
    }

    let req;

    if (isHttps) {
        req = https.request(requestOptions, requestResponse);
    } else {
        req = http.request(requestOptions, requestResponse);
    }

    req.on("error", err => {
        if (typeof callback === "function") {
            callback(err); // eslint-disable-line callback-return
        } else {
            log(err, callback);
        }
    });

    if (body) {
        req.write(JSON.stringify(body));
    }

    req.end();

    return ee;
}

const lookup = util.promisify(dns.lookup);

async function getIP() {
    const { address } = process.env.ARGO_IP
        ? { address: process.env.ARGO_IP } : await lookup(os.hostname());

    return address;
}
