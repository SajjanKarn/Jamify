// YouTube streaming URL resolution.
//
// We use a two-step strategy:
//   1. Try the InnerTube `player` endpoint (cheap, ~1 req per track).
//      If it returns a direct `url` (progressive/adaptive), use it.
//   2. Fall back to spawning `yt-dlp --get-url --format bestaudio`,
//      which handles signature decryption and yields a real URL.
//
// Both branches go through the same { audioUrl, expiresAt, track } shape
// the client expects.
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _a, _b;
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fetch } from "undici";
var INNER_TUBE_BASE = "https://www.youtube.com/youtubei/v1";
var WEB_API_KEY = (_a = process.env.YT_API_KEY) !== null && _a !== void 0 ? _a : "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y_YfRv9c";
var CLIENT_VERSION = "2.20240101.00.00";
var YT_DLP_BIN = (_b = process.env.YT_DLP_BIN) !== null && _b !== void 0 ? _b : "/Users/sajjankarna/Library/Python/3.13/bin/yt-dlp";
// macOS system Python often lacks a working CA bundle. Locate the certifi
// cacert.pem (pip-installed next to the binary) so yt-dlp can verify TLS.
function locateCertBundle() {
    var candidates = [
        process.env.SSL_CERT_FILE,
        "/Users/sajjankarna/Library/Python/3.13/lib/python/site-packages/certifi/cacert.pem",
        "/usr/local/lib/python3.13/site-packages/certifi/cacert.pem",
        "/opt/homebrew/lib/python3.13/site-packages/certifi/cacert.pem",
    ];
    for (var _i = 0, candidates_1 = candidates; _i < candidates_1.length; _i++) {
        var p = candidates_1[_i];
        if (p && existsSync(p))
            return p;
    }
    return undefined;
}
function innerTube(path, body) {
    return __awaiter(this, void 0, void 0, function () {
        var url, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    url = "".concat(INNER_TUBE_BASE, "/").concat(path, "?key=").concat(WEB_API_KEY, "&prettyPrint=false");
                    return [4 /*yield*/, fetch(url, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Accept: "application/json" },
                            body: JSON.stringify(__assign(__assign({}, body), { context: {
                                    client: {
                                        clientName: "WEB",
                                        clientVersion: CLIENT_VERSION,
                                        hl: "en",
                                        gl: "US",
                                    },
                                } })),
                        })];
                case 1:
                    res = _a.sent();
                    if (!res.ok)
                        throw new Error("InnerTube ".concat(path, " failed: ").concat(res.status));
                    return [4 /*yield*/, res.json()];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function ytDlpGetUrl(videoId) {
    return new Promise(function (resolve, reject) {
        var env = __assign({}, process.env);
        var cert = locateCertBundle();
        if (cert)
            env.SSL_CERT_FILE = cert;
        var proc = spawn(YT_DLP_BIN, [
            "--no-warnings",
            "--no-playlist",
            "--no-progress",
            "-f",
            "bestaudio[ext=m4a]/bestaudio/best",
            "-g",
            videoId,
        ], { stdio: ["ignore", "pipe", "pipe"], env: env });
        var stdout = "";
        var stderr = "";
        proc.stdout.on("data", function (d) { return (stdout += d.toString()); });
        proc.stderr.on("data", function (d) { return (stderr += d.toString()); });
        var timeout = setTimeout(function () {
            proc.kill("SIGKILL");
            reject(new Error("yt-dlp timeout (".concat(videoId, ")")));
        }, 25000);
        proc.on("close", function (code) {
            clearTimeout(timeout);
            var url = stdout.trim().split("\n").filter(Boolean).pop();
            if (code === 0 && url)
                resolve(url);
            else
                reject(new Error("yt-dlp exit ".concat(code, ": ").concat(stderr.slice(-200))));
        });
        proc.on("error", function (err) {
            clearTimeout(timeout);
            reject(err);
        });
    });
}
// --------------------------------------------------------------------------
// Search
// --------------------------------------------------------------------------
export function searchTracks(query) {
    return __awaiter(this, void 0, void 0, function () {
        var json, contents, tracks, _i, contents_1, item, v;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1;
        return __generator(this, function (_2) {
            switch (_2.label) {
                case 0:
                    if (!query.trim())
                        return [2 /*return*/, []];
                    return [4 /*yield*/, innerTube("search", {
                            query: query,
                            params: "EgWKAQIIAVoMEA4QChADEAoQAxAEEAUQCRAFEBEQEBAVEDE",
                        })];
                case 1:
                    json = _2.sent();
                    contents = (_h = (_g = (_f = (_e = (_d = (_c = (_b = (_a = json === null || json === void 0 ? void 0 : json.contents) === null || _a === void 0 ? void 0 : _a.twoColumnSearchResultsRenderer) === null || _b === void 0 ? void 0 : _b.primaryContents) === null || _c === void 0 ? void 0 : _c.sectionListRenderer) === null || _d === void 0 ? void 0 : _d.contents) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.itemSectionRenderer) === null || _g === void 0 ? void 0 : _g.contents) !== null && _h !== void 0 ? _h : [];
                    tracks = [];
                    for (_i = 0, contents_1 = contents; _i < contents_1.length; _i++) {
                        item = contents_1[_i];
                        v = item.videoRenderer;
                        if (!(v === null || v === void 0 ? void 0 : v.videoId))
                            continue;
                        tracks.push({
                            id: v.videoId,
                            title: (_o = (_l = (_k = (_j = v.title) === null || _j === void 0 ? void 0 : _j.runs) === null || _k === void 0 ? void 0 : _k.map(function (r) { return r.text; }).join("")) !== null && _l !== void 0 ? _l : (_m = v.title) === null || _m === void 0 ? void 0 : _m.simpleText) !== null && _o !== void 0 ? _o : "Untitled",
                            artist: (_v = (_r = (_q = (_p = v.ownerText) === null || _p === void 0 ? void 0 : _p.runs) === null || _q === void 0 ? void 0 : _q.map(function (r) { return r.text; }).join("")) !== null && _r !== void 0 ? _r : (_u = (_t = (_s = v.longBylineText) === null || _s === void 0 ? void 0 : _s.runs) === null || _t === void 0 ? void 0 : _t[0]) === null || _u === void 0 ? void 0 : _u.text) !== null && _v !== void 0 ? _v : "Unknown artist",
                            durationSec: parseLength((_x = (_w = v.lengthText) === null || _w === void 0 ? void 0 : _w.simpleText) !== null && _x !== void 0 ? _x : "0:00"),
                            thumbnail: (_1 = (_0 = (_z = (_y = v.thumbnail) === null || _y === void 0 ? void 0 : _y.thumbnails) === null || _z === void 0 ? void 0 : _z.pop()) === null || _0 === void 0 ? void 0 : _0.url) !== null && _1 !== void 0 ? _1 : "https://i.ytimg.com/vi/".concat(v.videoId, "/hqdefault.jpg"),
                        });
                    }
                    return [2 /*return*/, tracks];
            }
        });
    });
}
// --------------------------------------------------------------------------
// Stream resolution — InnerTube first, yt-dlp fallback.
// --------------------------------------------------------------------------
export function resolveStream(videoId) {
    return __awaiter(this, void 0, void 0, function () {
        var track, json, details, streaming, expires, adaptive, progressive, audioOnly, progressiveAudio, directUrl, _a, audioUrl;
        var _b, _c, _d, _e, _f, _g, _h, _j;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    track = {
                        id: videoId,
                        title: "Untitled",
                        artist: "Unknown artist",
                        durationSec: 0,
                        thumbnail: "https://i.ytimg.com/vi/".concat(videoId, "/hqdefault.jpg"),
                    };
                    _k.label = 1;
                case 1:
                    _k.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, innerTube("player", { video_id: videoId })];
                case 2:
                    json = _k.sent();
                    details = json === null || json === void 0 ? void 0 : json.videoDetails;
                    streaming = (_b = json === null || json === void 0 ? void 0 : json.streamingData) !== null && _b !== void 0 ? _b : {};
                    expires = Number((_c = streaming === null || streaming === void 0 ? void 0 : streaming.expiresInSeconds) !== null && _c !== void 0 ? _c : 21540);
                    adaptive = (_d = streaming === null || streaming === void 0 ? void 0 : streaming.adaptiveFormats) !== null && _d !== void 0 ? _d : [];
                    progressive = (_e = streaming === null || streaming === void 0 ? void 0 : streaming.formats) !== null && _e !== void 0 ? _e : [];
                    audioOnly = adaptive
                        .filter(function (f) { var _a; return ((_a = f.mimeType) === null || _a === void 0 ? void 0 : _a.startsWith("audio/")) && f.url; })
                        .sort(function (a, b) { var _a, _b; return ((_a = b.bitrate) !== null && _a !== void 0 ? _a : 0) - ((_b = a.bitrate) !== null && _b !== void 0 ? _b : 0); })[0];
                    progressiveAudio = progressive
                        .filter(function (f) { return f.url; })
                        .sort(function (a, b) { var _a, _b; return ((_a = b.bitrate) !== null && _a !== void 0 ? _a : 0) - ((_b = a.bitrate) !== null && _b !== void 0 ? _b : 0); })[0];
                    directUrl = (_f = audioOnly === null || audioOnly === void 0 ? void 0 : audioOnly.url) !== null && _f !== void 0 ? _f : progressiveAudio === null || progressiveAudio === void 0 ? void 0 : progressiveAudio.url;
                    if (directUrl) {
                        if (details) {
                            track = {
                                id: videoId,
                                title: (_g = details.title) !== null && _g !== void 0 ? _g : track.title,
                                artist: (_h = details.author) !== null && _h !== void 0 ? _h : track.artist,
                                durationSec: Number((_j = details.lengthSeconds) !== null && _j !== void 0 ? _j : 0),
                                thumbnail: track.thumbnail,
                            };
                        }
                        return [2 /*return*/, {
                                audioUrl: directUrl,
                                expiresAt: Date.now() + expires * 1000,
                                track: track,
                            }];
                    }
                    return [3 /*break*/, 4];
                case 3:
                    _a = _k.sent();
                    return [3 /*break*/, 4];
                case 4: return [4 /*yield*/, ytDlpGetUrl(videoId)];
                case 5:
                    audioUrl = _k.sent();
                    return [2 /*return*/, {
                            audioUrl: audioUrl,
                            // Stream URLs typically live 6 hours.
                            expiresAt: Date.now() + 6 * 60 * 60 * 1000,
                            track: track,
                        }];
            }
        });
    });
}
// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
function parseLength(text) {
    var parts = text.split(":").map(function (p) { return Number(p); });
    if (parts.some(isNaN))
        return 0;
    if (parts.length === 2)
        return parts[0] * 60 + parts[1];
    if (parts.length === 3)
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
}
