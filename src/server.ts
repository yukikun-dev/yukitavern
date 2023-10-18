#!/usr/bin/env node
import tiktoken from "@dqbd/tiktoken";
import { Tokenizer } from "@mlc-ai/web-tokenizers";
import axios from "axios";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import crypto from "crypto";
import { doubleCsrf } from "csrf-csrf";
import DeviceDetector from "device-detector-js";
import express from "express";
import fs from "fs";
import http from "http";
import https from "https";
import ipMatching from "ip-matching";
import ipaddr from "ipaddr.js";
import jimp from "jimp";
import json5 from "json5";
import _ from "lodash";
import mime from "mime-types";
import multer from "multer";
import { default as fetch } from "node-fetch";
import { Client } from "node-rest-client";
import open from "open";
import path from "path";
import PNGtext from "png-chunk-text";
import encode from "png-chunks-encode";
import extract from "png-chunks-extract";
import process from "process";
import readline from "readline";
import responseTime from "response-time";
import sanitize from "sanitize-filename";
import { SentencePieceProcessor } from "sentencepiece-js";
import { TextDecoder } from "util";
import WebSocket from "ws";
import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";
import yauzl from "yauzl";
import { parse } from "./character-card-parser.js";
import contentManager from "./content-manager.js";
import basicAuthMiddleware from "./middleware/basicAuthMiddleware.js";
import * as statsHelpers from "./statsHelpers.js";

const baseDir = process.cwd();

createDefaultFiles();

function createDefaultFiles() {
    const files = {
        settings: path.join(baseDir, "public", "settings.json"),
        bg_load: path.join(baseDir, "public", "css", "bg_load.css"),
        config: path.join(baseDir, "src", "config.json"),
    };

    for (const file of Object.values(files)) {
        try {
            if (!fs.existsSync(file)) {
                const defaultFilePath = path.join("default", path.parse(file).base);
                fs.copyFileSync(defaultFilePath, file);
                console.log(`Created default file: ${file}`);
            }
        } catch (error) {
            console.error(`FATAL: Could not write default file: ${file}`, error);
        }
    }
}

const cliArguments = await yargs(hideBin(process.argv))
    .option("disableCsrf", {
        type: "boolean",
        default: false,
        describe: "Disables CSRF protection",
    })
    .option("ssl", {
        type: "boolean",
        default: false,
        describe: "Enables SSL",
    })
    .option("certPath", {
        type: "string",
        default: "certs/cert.pem",
        describe: "Path to your certificate file.",
    })
    .option("keyPath", {
        type: "string",
        default: "certs/privkey.pem",
        describe: "Path to your private key file.",
    }).argv;

const app = express();

app.use(compression());
app.use(responseTime());

import config from "./config.json" assert { type: "json" };

const server_port = process.env.SILLY_TAVERN_PORT || config.port;

const whitelistMode = config.whitelistMode;
const autorun = config.autorun && !cliArguments.ssl;
const enableExtensions = config.enableExtensions;
const listen = config.listen;
const allowKeysExposure = config.allowKeysExposure;

const client = new Client();

client.on("error", (err) => {
    console.error("An error occurred:", err);
});

let api_server = "http://0.0.0.0:5000";
let api_openai = "https://api.openai.com/v1";
let api_claude = "https://api.anthropic.com/v1";

let characters = {};
let response_dw_bg;

function get_mancer_headers() {
    const api_key_mancer = readSecret(SECRET_KEYS.MANCER);
    return api_key_mancer ? { "X-API-KEY": api_key_mancer } : {};
}

//RossAscends: Added function to format dates used in files and chat timestamps to a humanized format.
//Mostly I wanted this to be for file names, but couldn't figure out exactly where the filename save code was as everything seemed to be connected.
//During testing, this performs the same as previous date.now() structure.
//It also does not break old characters/chats, as the code just uses whatever timestamp exists in the chat.
//New chats made with characters will use this new formatting.
//Useable variable is (( humanizedISO8601Datetime ))

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CHARS_PER_TOKEN = 3.35;

let spp_llama;
let spp_nerd;
let spp_nerd_v2;
let claude_tokenizer;

async function loadSentencepieceTokenizer(modelPath) {
    try {
        const spp = new SentencePieceProcessor();
        await spp.load(modelPath);
        return spp;
    } catch (error) {
        console.error("Sentencepiece tokenizer failed to load: " + modelPath, error);
        return null;
    }
}

async function countSentencepieceTokens(spp, text) {
    // Fallback to strlen estimation
    if (!spp) {
        return {
            ids: [],
            count: Math.ceil(text.length / CHARS_PER_TOKEN),
        };
    }

    let cleaned = text; // cleanText(text); <-- cleaning text can result in an incorrect tokenization

    let ids = spp.encodeIds(cleaned);
    return {
        ids,
        count: ids.length,
    };
}

async function loadClaudeTokenizer(modelPath) {
    try {
        const arrayBuffer = fs.readFileSync(modelPath).buffer;
        const instance = await Tokenizer.fromJSON(arrayBuffer);
        return instance;
    } catch (error) {
        console.error("Claude tokenizer failed to load: " + modelPath, error);
        return null;
    }
}

function countClaudeTokens(tokenizer, messages) {
    const convertedPrompt = convertClaudePrompt(messages, false, false);

    // Fallback to strlen estimation
    if (!tokenizer) {
        return Math.ceil(convertedPrompt.length / CHARS_PER_TOKEN);
    }

    const count = tokenizer.encode(convertedPrompt).length;
    return count;
}

const tokenizersCache = {};

function getTokenizerModel(requestModel) {
    if (requestModel.includes("claude")) {
        return "claude";
    }

    if (requestModel.includes("gpt-4-32k")) {
        return "gpt-4-32k";
    }

    if (requestModel.includes("gpt-4")) {
        return "gpt-4";
    }

    if (requestModel.includes("gpt-3.5-turbo")) {
        return "gpt-3.5-turbo";
    }

    if (requestModel.startsWith("text-") || requestModel.startsWith("code-")) {
        return requestModel;
    }

    // default
    return "gpt-3.5-turbo";
}

function getTiktokenTokenizer(model) {
    if (tokenizersCache[model]) {
        return tokenizersCache[model];
    }

    const tokenizer = tiktoken.encoding_for_model(model);
    console.log("Instantiated the tokenizer for", model);
    tokenizersCache[model] = tokenizer;
    return tokenizer;
}

function humanizedISO8601DateTime() {
    let baseDate = new Date(Date.now());
    let humanYear = baseDate.getFullYear();
    let humanMonth = baseDate.getMonth() + 1;
    let humanDate = baseDate.getDate();
    let humanHour = (baseDate.getHours() < 10 ? "0" : "") + baseDate.getHours();
    let humanMinute = (baseDate.getMinutes() < 10 ? "0" : "") + baseDate.getMinutes();
    let humanSecond = (baseDate.getSeconds() < 10 ? "0" : "") + baseDate.getSeconds();
    let humanMillisecond = (baseDate.getMilliseconds() < 10 ? "0" : "") + baseDate.getMilliseconds();
    let HumanizedDateTime =
        humanYear +
        "-" +
        humanMonth +
        "-" +
        humanDate +
        " @" +
        humanHour +
        "h " +
        humanMinute +
        "m " +
        humanSecond +
        "s " +
        humanMillisecond +
        "ms";
    return HumanizedDateTime;
}

const AVATAR_WIDTH = 400;
const AVATAR_HEIGHT = 600;
const jsonParser = express.json({ limit: "100mb" });
const urlencodedParser = express.urlencoded({ extended: true, limit: "100mb" });
const directories = {
    worlds: path.join(baseDir, "public", "worlds"),
    avatars: path.join(baseDir, "public", "User Avatars"),
    groups: path.join(baseDir, "public", "groups"),
    groupChats: path.join(baseDir, "public", "group chats"),
    chats: path.join(baseDir, "public", "chats"),
    characters: path.join(baseDir, "public", "characters"),
    backgrounds: path.join(baseDir, "public", "backgrounds"),
    openAI_Settings: path.join(baseDir, "public", "OpenAI Settings"),
    textGen_Settings: path.join(baseDir, "public", "TextGen Settings"),
    thumbnails: path.join(baseDir, "thumbnails"),
    thumbnailsBg: path.join(baseDir, "thumbnails", "bg"),
    thumbnailsAvatar: path.join(baseDir, "thumbnails", "avatar"),
    themes: path.join(baseDir, "public", "themes"),
    extensions: path.join(baseDir, "public", "scripts", "extensions"),
    context: path.join(baseDir, "public", "context"),
    backups: path.join(baseDir, "backups"),
    quickreplies: path.join(baseDir, "public", "QuickReplies"),
    uploads: path.join(baseDir, "uploads"),
};

// CSRF Protection //
if (cliArguments.disableCsrf === false) {
    const CSRF_SECRET = crypto.randomBytes(8).toString("hex");
    const COOKIES_SECRET = crypto.randomBytes(8).toString("hex");

    const { generateToken, doubleCsrfProtection } = doubleCsrf({
        getSecret: () => CSRF_SECRET,
        cookieName: "X-CSRF-Token",
        cookieOptions: {
            httpOnly: true,
            sameSite: "strict",
            secure: false,
        },
        size: 64,
        getTokenFromRequest: (req) => req.headers["x-csrf-token"],
    });

    app.get("/csrf-token", (req, res) => {
        res.json({
            token: generateToken(res),
        });
    });

    app.use(cookieParser(COOKIES_SECRET));
    app.use(doubleCsrfProtection);
} else {
    console.warn("\nCSRF protection is disabled. This will make your server vulnerable to CSRF attacks.\n");
    app.get("/csrf-token", (req, res) => {
        res.json({
            token: "disabled",
        });
    });
}

// CORS Settings //

const CORS = cors({
    origin: "null",
    methods: ["OPTIONS"],
});

app.use(CORS);

if (listen && config.basicAuthMode) app.use(basicAuthMiddleware);

app.use(function (req, res, next) {
    //Security
    let clientIp = req.socket.remoteAddress;
    let ip = ipaddr.parse(clientIp);
    // Check if the IP address is IPv4-mapped IPv6 address
    if (ip.kind() === "ipv6" && ip.isIPv4MappedAddress()) {
        const ipv4 = ip.toIPv4Address().toString();
        clientIp = ipv4;
    } else {
        clientIp = ip.toString();
    }

    if (whitelistMode === true && !config.whitelist.some((x) => ipMatching.matches(clientIp, ipMatching.getMatch(x)))) {
        console.log(
            "Forbidden: Connection attempt from " +
                clientIp +
                ". If you are attempting to connect, please add your IP address in whitelist or disable whitelist mode in config.json in root of yukitavern folder.\n",
        );
        return res
            .status(403)
            .send(
                "<b>Forbidden</b>: Connection attempt from <b>" +
                    clientIp +
                    "</b>. If you are attempting to connect, please add your IP address in whitelist or disable whitelist mode in config.json in root of yukitavern folder.",
            );
    }
    next();
});

app.use(express.static(path.join(baseDir, "public")));

app.use("/backgrounds", (req, res) => {
    const filePath = decodeURIComponent(path.join(baseDir, "public", "backgrounds", req.url.replace(/%20/g, " ")));
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.status(404).send("File not found");
            return;
        }
        //res.contentType('image/jpeg');
        res.send(data);
    });
});

app.use("/characters", (req, res) => {
    const filePath = decodeURIComponent(path.join(directories.characters, req.url.replace(/%20/g, " ")));
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.status(404).send("File not found");
            return;
        }
        res.send(data);
    });
});
app.use(multer({ dest: "uploads", limits: { fieldSize: 10 * 1024 * 1024 } }).single("avatar"));
app.get("/", function (request, response) {
    response.sendFile(path.join(baseDir, "/public/index.html"));
});
app.get("/notes/*", function (request, response) {
    response.sendFile(path.join(baseDir, "/public" + request.url + ".html"));
});
app.get("/deviceinfo", function (request, response) {
    const userAgent = request.header("user-agent");
    const deviceDetector = new DeviceDetector();
    const deviceInfo = deviceDetector.parse(userAgent);
    return response.send(deviceInfo);
});

//************** Text generation web UI
app.post("/generate_textgenerationwebui", jsonParser, async function (request, response_generate) {
    if (!request.body) return response_generate.sendStatus(400);

    console.log(request.body);

    const controller = new AbortController();
    let isGenerationStopped = false;
    request.socket.removeAllListeners("close");
    request.socket.on("close", function () {
        isGenerationStopped = true;
        controller.abort();
    });

    if (request.header("X-Response-Streaming")) {
        response_generate.writeHead(200, {
            "Content-Type": "text/plain;charset=utf-8",
            "Transfer-Encoding": "chunked",
            "Cache-Control": "no-transform",
        });

        async function* readWebsocket() {
            const streamingUrl = request.header("X-Streaming-URL");
            const websocket = new WebSocket(streamingUrl);

            websocket.on("open", async function () {
                console.log("websocket open");
                websocket.send(JSON.stringify(request.body));
            });

            websocket.on("error", (err) => {
                console.error(err);
                websocket.close();
            });

            websocket.on("close", (code, buffer) => {
                const reason = new TextDecoder().decode(buffer);
                console.log(reason);
            });

            while (true) {
                if (isGenerationStopped) {
                    console.error("Streaming stopped by user. Closing websocket...");
                    websocket.close();
                    return;
                }

                const rawMessage = (await new Promise((resolve) => websocket.once("message", resolve))) as string;
                const message = json5.parse(rawMessage);

                switch (message.event) {
                    case "text_stream":
                        yield message.text;
                        break;
                    case "stream_end":
                        websocket.close();
                        return;
                }
            }
        }

        let reply = "";

        try {
            for await (const text of readWebsocket()) {
                if (typeof text !== "string") {
                    break;
                }

                let newText = text;

                if (!newText) {
                    continue;
                }

                reply += text;
                response_generate.write(newText);
            }

            console.log(reply);
        } finally {
            response_generate.end();
        }
    } else {
        const args = {
            body: JSON.stringify(request.body),
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
        };

        if (request.body.use_mancer) {
            args.headers = Object.assign(args.headers, get_mancer_headers());
        }

        try {
            const data = await postAsync(api_server + "/v1/generate", args);
            console.log(data);
            return response_generate.send(data);
        } catch (error) {
            var retval = {
                error: true,
                status: error.status,
                response: error.statusText,
            };
            console.log(error);
            try {
                retval.response = await error.json();
                retval.response = retval.response.result;
            } catch {
                _.noop();
            }
            return response_generate.send(retval);
        }
    }
});

app.post("/savechat", jsonParser, function (request, response) {
    try {
        var dir_name = String(request.body.avatar_url).replace(".png", "");
        let chat_data = request.body.chat;
        let jsonlData = chat_data.map(JSON.stringify).join("\n");
        fs.writeFileSync(
            `${directories.chats + sanitize(dir_name)}/${sanitize(String(request.body.file_name))}.jsonl`,
            jsonlData,
            "utf8",
        );
        return response.send({ result: "ok" });
    } catch (error) {
        response.send(error);
        return console.log(error);
    }
});

app.post("/getchat", jsonParser, function (request, response) {
    try {
        const dirName = String(request.body.avatar_url).replace(".png", "");
        const chatDirExists = fs.existsSync(directories.chats + dirName);

        //if no chat dir for the character is found, make one with the character name
        if (!chatDirExists) {
            fs.mkdirSync(directories.chats + dirName);
            return response.send({});
        }

        if (!request.body.file_name) {
            return response.send({});
        }

        const fileName = `${directories.chats + dirName}/${sanitize(String(request.body.file_name))}.jsonl`;
        const chatFileExists = fs.existsSync(fileName);

        if (!chatFileExists) {
            return response.send({});
        }

        const data = fs.readFileSync(fileName, "utf8");
        const lines = data.split("\n");

        // Iterate through the array of strings and parse each line as JSON
        const jsonData = lines.map(tryParse).filter((x) => x);
        return response.send(jsonData);
    } catch (error) {
        console.error(error);
        return response.send({});
    }
});

app.post("/getstatus", jsonParser, async function (request, response_getstatus = response) {
    if (!request.body) return response_getstatus.sendStatus(400);
    api_server = request.body.api_server;
    const main_api = request.body.main_api;
    if (api_server.indexOf("localhost") != -1) {
        api_server = api_server.replace("localhost", "127.0.0.1");
    }
    var args = {
        headers: { "Content-Type": "application/json" },
    };

    if (main_api == "textgenerationwebui" && request.body.use_mancer) {
        args.headers = Object.assign(args.headers, get_mancer_headers());
    }

    var url = api_server + "/v1/model";
    let version = "";
    client
        .get(url, args, async function (data, response) {
            if (typeof data !== "object") {
                data = {};
            }
            if (response.statusCode == 200) {
                data.version = version;
                if (data.result == "ReadOnly") {
                    data.result = "no_connection";
                }
            } else {
                data.response = data.result;
                data.result = "no_connection";
            }
            response_getstatus.send(data);
        })
        .on("error", function () {
            response_getstatus.send({ result: "no_connection" });
        });
});

function tryParse(str) {
    try {
        return json5.parse(str);
    } catch {
        return undefined;
    }
}

function convertToV2(char) {
    // Simulate incoming data from frontend form
    const result = charaFormatData({
        json_data: JSON.stringify(char),
        ch_name: char.name,
        description: char.description,
        personality: char.personality,
        scenario: char.scenario,
        first_mes: char.first_mes,
        mes_example: char.mes_example,
        creator_notes: char.creatorcomment,
        talkativeness: char.talkativeness,
        fav: char.fav,
        creator: char.creator,
        tags: char.tags,
    });

    result.chat = char.chat ?? humanizedISO8601DateTime();
    result.create_date = char.create_date;
    return result;
}

function unsetFavFlag(char) {
    _.set(char, "fav", false);
    _.set(char, "data.extensions.fav", false);
}

function readFromV2(char) {
    if (_.isUndefined(char.data)) {
        console.warn("Spec v2 data missing");
        return char;
    }

    const fieldMappings = {
        name: "name",
        description: "description",
        personality: "personality",
        scenario: "scenario",
        first_mes: "first_mes",
        mes_example: "mes_example",
        talkativeness: "extensions.talkativeness",
        fav: "extensions.fav",
        tags: "tags",
    };

    _.forEach(fieldMappings, (v2Path, charField) => {
        //console.log(`Migrating field: ${charField} from ${v2Path}`);
        const v2Value = _.get(char.data, v2Path);
        if (_.isUndefined(v2Value)) {
            let defaultValue = undefined;

            // Backfill default values for missing ST extension fields
            if (v2Path === "extensions.talkativeness") {
                defaultValue = 0.5;
            }

            if (v2Path === "extensions.fav") {
                defaultValue = false;
            }

            if (!_.isUndefined(defaultValue)) {
                //console.debug(`Spec v2 extension data missing for field: ${charField}, using default value: ${defaultValue}`);
                char[charField] = defaultValue;
            } else {
                console.debug(`Spec v2 data missing for unknown field: ${charField}`);
                return;
            }
        }
        if (!_.isUndefined(char[charField]) && !_.isUndefined(v2Value) && String(char[charField]) !== String(v2Value)) {
            console.debug(`Spec v2 data mismatch with Spec v1 for field: ${charField}`, char[charField], v2Value);
        }
        char[charField] = v2Value;
    });

    char["chat"] = char["chat"] ?? humanizedISO8601DateTime();

    return char;
}

//***************** Main functions
function charaFormatData(data) {
    // This is supposed to save all the foreign keys that ST doesn't care about
    const char = tryParse(data.json_data) || {};

    // This function uses _.cond() to create a series of conditional checks that return the desired output based on the input data.
    // It checks if data.alternate_greetings is an array, a string, or neither, and acts accordingly.
    const getAlternateGreetings = (data) =>
        _.cond([
            [(d) => Array.isArray(d.alternate_greetings), (d) => d.alternate_greetings],
            [(d) => typeof d.alternate_greetings === "string", (d) => [d.alternate_greetings]],
            [_.stubTrue, _.constant([])],
        ])(data);

    // Spec V1 fields
    _.set(char, "name", data.ch_name);
    _.set(char, "description", data.description || "");
    _.set(char, "personality", data.personality || "");
    _.set(char, "scenario", data.scenario || "");
    _.set(char, "first_mes", data.first_mes || "");
    _.set(char, "mes_example", data.mes_example || "");

    // Old ST extension fields (for backward compatibility, will be deprecated)
    _.set(char, "creatorcomment", data.creator_notes);
    _.set(char, "avatar", "none");
    _.set(char, "chat", data.ch_name + " - " + humanizedISO8601DateTime());
    _.set(char, "talkativeness", data.talkativeness);
    _.set(char, "fav", data.fav == "true");
    _.set(char, "create_date", humanizedISO8601DateTime());

    // Spec V2 fields
    _.set(char, "spec", "chara_card_v2");
    _.set(char, "spec_version", "2.0");
    _.set(char, "data.name", data.ch_name);
    _.set(char, "data.description", data.description || "");
    _.set(char, "data.personality", data.personality || "");
    _.set(char, "data.scenario", data.scenario || "");
    _.set(char, "data.first_mes", data.first_mes || "");
    _.set(char, "data.mes_example", data.mes_example || "");

    // New V2 fields
    _.set(char, "data.creator_notes", data.creator_notes || "");
    _.set(char, "data.system_prompt", data.system_prompt || "");
    _.set(char, "data.post_history_instructions", data.post_history_instructions || "");
    _.set(
        char,
        "data.tags",
        typeof data.tags == "string"
            ? data.tags
                  .split(",")
                  .map((x) => x.trim())
                  .filter((x) => x)
            : data.tags || [],
    );
    _.set(char, "data.creator", data.creator || "");
    _.set(char, "data.character_version", data.character_version || "");
    _.set(char, "data.alternate_greetings", getAlternateGreetings(data));

    // ST extension fields to V2 object
    _.set(char, "data.extensions.talkativeness", data.talkativeness);
    _.set(char, "data.extensions.fav", data.fav == "true");
    _.set(char, "data.extensions.world", data.world || "");
    //_.set(char, 'data.extensions.create_date', humanizedISO8601DateTime());
    //_.set(char, 'data.extensions.avatar', 'none');
    //_.set(char, 'data.extensions.chat', data.ch_name + ' - ' + humanizedISO8601DateTime());

    if (data.world) {
        try {
            const file = readWorldInfoFile(data.world);

            // File was imported - save it to the character book
            if (file && file.originalData) {
                _.set(char, "data.character_book", file.originalData);
            }

            // File was not imported - convert the world info to the character book
            if (file && file.entries) {
                _.set(char, "data.character_book", convertWorldInfoToCharacterBook(data.world, file.entries));
            }
        } catch {
            console.debug(`Failed to read world info file: ${data.world}. Character book will not be available.`);
        }
    }

    return char;
}

app.post("/createcharacter", urlencodedParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    request.body.ch_name = sanitize(request.body.ch_name);

    const char = JSON.stringify(charaFormatData(request.body));
    const internalName = getPngName(request.body.ch_name);
    const avatarName = `${internalName}.png`;
    const defaultAvatar = path.join(baseDir, "public", "img", "ai4.png");
    const chatsPath = directories.chats + internalName; //path.join(directories.chats, internalName);

    if (!fs.existsSync(chatsPath)) fs.mkdirSync(chatsPath);

    if (!request.file) {
        charaWrite(defaultAvatar, char, internalName, response, avatarName);
    } else {
        const crop = tryParse(request.query.crop);
        const uploadPath = path.join(directories.uploads, request.file.filename);
        charaWrite(uploadPath, char, internalName, response, avatarName, crop);
    }
});

app.post("/renamechat", jsonParser, async function (request, response) {
    if (!request.body || !request.body.original_file || !request.body.renamed_file) {
        return response.sendStatus(400);
    }

    const pathToFolder = request.body.is_group
        ? directories.groupChats
        : path.join(directories.chats, String(request.body.avatar_url).replace(".png", ""));
    const pathToOriginalFile = path.join(pathToFolder, request.body.original_file);
    const pathToRenamedFile = path.join(pathToFolder, request.body.renamed_file);
    console.log("Old chat name", pathToOriginalFile);
    console.log("New chat name", pathToRenamedFile);

    if (!fs.existsSync(pathToOriginalFile) || fs.existsSync(pathToRenamedFile)) {
        console.log("Either Source or Destination files are not available");
        return response.status(400).send({ error: true });
    }

    console.log("Successfully renamed.");
    fs.renameSync(pathToOriginalFile, pathToRenamedFile);
    return response.send({ ok: true });
});

app.post("/renamecharacter", jsonParser, async function (request, response) {
    if (!request.body.avatar_url || !request.body.new_name) {
        return response.sendStatus(400);
    }

    const oldAvatarName = request.body.avatar_url;
    const newName = sanitize(request.body.new_name);
    const oldInternalName = path.parse(request.body.avatar_url).name;
    const newInternalName = getPngName(newName);
    const newAvatarName = `${newInternalName}.png`;

    const oldAvatarPath = path.join(directories.characters, oldAvatarName);

    const oldChatsPath = path.join(directories.chats, oldInternalName);
    const newChatsPath = path.join(directories.chats, newInternalName);

    try {
        // Read old file, replace name int it
        const rawOldData = await charaRead(oldAvatarPath);
        const oldData = getCharaCardV2(json5.parse(rawOldData));
        _.set(oldData, "data.name", newName);
        _.set(oldData, "name", newName);
        const newData = JSON.stringify(oldData);

        // Write data to new location
        await charaWrite(oldAvatarPath, newData, newInternalName);

        // Rename chats folder
        if (fs.existsSync(oldChatsPath) && !fs.existsSync(newChatsPath)) {
            fs.renameSync(oldChatsPath, newChatsPath);
        }

        // Remove the old character file
        fs.rmSync(oldAvatarPath);

        // Return new avatar name to ST
        return response.send({ avatar: newAvatarName });
    } catch (err) {
        console.error(err);
        return response.sendStatus(500);
    }
});

app.post("/editcharacter", urlencodedParser, async function (request, response) {
    if (!request.body) {
        console.error("Error: no response body detected");
        response.status(400).send("Error: no response body detected");
        return;
    }

    if (request.body.ch_name === "" || request.body.ch_name === undefined || request.body.ch_name === ".") {
        console.error("Error: invalid name.");
        response.status(400).send("Error: invalid name.");
        return;
    }

    let char = charaFormatData(request.body);
    char.chat = request.body.chat;
    char.create_date = request.body.create_date;
    char = JSON.stringify(char);
    let target_img = request.body.avatar_url.replace(".png", "");

    try {
        if (!request.file) {
            const avatarPath = path.join(directories.characters, request.body.avatar_url);
            await charaWrite(avatarPath, char, target_img, response, "Character saved");
        } else {
            const crop = tryParse(request.query.crop);
            const newAvatarPath = path.join(directories.uploads, request.file.filename);
            invalidateThumbnail("avatar", request.body.avatar_url);
            await charaWrite(newAvatarPath, char, target_img, response, "Character saved", crop);
        }
    } catch {
        console.error("An error occured, character edit invalidated.");
    }
});

app.post("/editcharacterattribute", jsonParser, async function (request, response) {
    console.log(request.body);
    if (!request.body) {
        console.error("Error: no response body detected");
        response.status(400).send("Error: no response body detected");
        return;
    }

    if (request.body.ch_name === "" || request.body.ch_name === undefined || request.body.ch_name === ".") {
        console.error("Error: invalid name.");
        response.status(400).send("Error: invalid name.");
        return;
    }

    try {
        const avatarPath = path.join(directories.characters, request.body.avatar_url);
        try {
            const charStr = await charaRead(avatarPath);
            const char: any = JSON.parse(charStr);
            //check if the field exists
            if (char[request.body.field] === undefined && char.data[request.body.field] === undefined) {
                console.error("Error: invalid field.");
                response.status(400).send("Error: invalid field.");
                return;
            }
            char[request.body.field] = request.body.value;
            char.data[request.body.field] = request.body.value;
            charaWrite(
                avatarPath,
                JSON.stringify(char),
                request.body.avatar_url.replace(".png", ""),
                response,
                "Character saved",
            );
        } catch (err) {
            console.error("An error occured, character edit invalidated.", err);
        }
    } catch {
        console.error("An error occured, character edit invalidated.");
    }
});

app.post("/deletecharacter", jsonParser, async function (request, response) {
    if (!request.body || !request.body.avatar_url) {
        return response.sendStatus(400);
    }

    if (request.body.avatar_url !== sanitize(request.body.avatar_url)) {
        console.error("Malicious filename prevented");
        return response.sendStatus(403);
    }

    const avatarPath = directories.characters + request.body.avatar_url;
    if (!fs.existsSync(avatarPath)) {
        return response.sendStatus(400);
    }

    fs.rmSync(avatarPath);
    invalidateThumbnail("avatar", request.body.avatar_url);
    let dir_name = request.body.avatar_url.replace(".png", "");

    if (!dir_name.length) {
        console.error("Malicious dirname prevented");
        return response.sendStatus(403);
    }

    if (request.body.delete_chats == true) {
        try {
            await fs.promises.rm(path.join(directories.chats, sanitize(dir_name)), {
                recursive: true,
                force: true,
            });
        } catch (err) {
            console.error(err);
            return response.sendStatus(500);
        }
    }

    return response.sendStatus(200);
});

async function charaWrite(img_url, data, target_img, response = undefined, mes = "ok", crop = undefined) {
    try {
        // Read the image, resize, and save it as a PNG into the buffer
        const image = await tryReadImage(img_url, crop);

        // Get the chunks
        const chunks = extract(image);
        const tEXtChunks = chunks.filter((chunk) => chunk.create_date === "tEXt" || chunk.name === "tEXt");

        // Remove all existing tEXt chunks
        for (let tEXtChunk of tEXtChunks) {
            chunks.splice(chunks.indexOf(tEXtChunk), 1);
        }
        const base64EncodedData = Buffer.from(data, "utf8").toString("base64");
        chunks.splice(-1, 0, PNGtext.encode("chara", base64EncodedData));

        fs.writeFileSync(directories.characters + target_img + ".png", Buffer.from(encode(chunks)));
        if (response !== undefined) response.send(mes);
        return true;
    } catch (err) {
        console.log(err);
        if (response !== undefined) response.status(500).send(err);
        return false;
    }
}

async function tryReadImage(img_url, crop) {
    try {
        let rawImg = await jimp.read(img_url);
        let final_width = rawImg.bitmap.width,
            final_height = rawImg.bitmap.height;

        // Apply crop if defined
        if (typeof crop == "object" && [crop.x, crop.y, crop.width, crop.height].every((x) => typeof x === "number")) {
            rawImg = rawImg.crop(crop.x, crop.y, crop.width, crop.height);
            // Apply standard resize if requested
            if (crop.want_resize) {
                final_width = AVATAR_WIDTH;
                final_height = AVATAR_HEIGHT;
            }
        }

        const image = await rawImg.cover(final_width, final_height).getBufferAsync(jimp.MIME_PNG);
        return image;
    } catch {
        // If it's an unsupported type of image (APNG) - just read the file as buffer
        return fs.readFileSync(img_url);
    }
}

async function charaRead(img_url: string, input_format: string = "png") {
    return parse(img_url, input_format);
}

const calculateChatSize = (charDir) => {
    let chatSize = 0;
    let dateLastChat = 0;

    if (fs.existsSync(charDir)) {
        const chats = fs.readdirSync(charDir);
        if (Array.isArray(chats) && chats.length) {
            for (const chat of chats) {
                const chatStat = fs.statSync(path.join(charDir, chat));
                chatSize += chatStat.size;
                dateLastChat = Math.max(dateLastChat, chatStat.mtimeMs);
            }
        }
    }

    return { chatSize, dateLastChat };
};

// Calculate the total string length of the data object
const calculateDataSize = (data: Object | ArrayLike<unknown>) => {
    if (typeof data !== "object") {
        return 0;
    }
    return Object.values(data).reduce((acc, val) => acc + String(val).length, 0);
};

const processCharacter = async (item, i) => {
    try {
        const img_data = await charaRead(path.join(directories.characters, item));
        let jsonObject = getCharaCardV2(json5.parse(img_data));
        jsonObject.avatar = item;
        characters[i] = jsonObject;
        characters[i]["json_data"] = img_data;
        const charStat = fs.statSync(path.join(directories.characters, item));
        characters[i]["date_added"] = charStat.birthtimeMs;
        const char_dir = path.join(directories.chats, item.replace(".png", ""));

        const { chatSize, dateLastChat } = calculateChatSize(char_dir);
        characters[i]["chat_size"] = chatSize;
        characters[i]["date_last_chat"] = dateLastChat;
        characters[i]["data_size"] = calculateDataSize(jsonObject?.data);
    } catch (err) {
        characters[i] = {
            date_added: 0,
            date_last_chat: 0,
            chat_size: 0,
        };

        console.log(`Could not process character: ${item}`);

        if (err instanceof SyntaxError) {
            console.log("String [" + i + "] is not valid JSON!");
        } else {
            console.log("An unexpected error occurred: ", err);
        }
    }
};

app.post("/getcharacters", jsonParser, function (_, response) {
    fs.readdir(directories.characters, async (err, files) => {
        if (err) {
            console.error(err);
            return;
        }

        const pngFiles = files.filter((file) => file.endsWith(".png"));
        characters = {};

        let processingPromises = pngFiles.map((file, index) => processCharacter(file, index));
        await Promise.all(processingPromises);
        performance.mark("B");

        response.send(JSON.stringify(characters));
    });
});

app.post("/getstats", jsonParser, function (_, response) {
    response.send(JSON.stringify(statsHelpers.getCharStats()));
});

app.post("/updatestats", jsonParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);
    statsHelpers.setCharStats(request.body);
    return response.sendStatus(200);
});

app.post("/getbackgrounds", jsonParser, function (_, response) {
    var images = getImages(path.join(baseDir, "public", "backgrounds"));
    response.send(JSON.stringify(images));
});

app.post("/getuseravatars", jsonParser, function (_, response) {
    var images = getImages(path.join(baseDir, "public", "User Avatars"));
    response.send(JSON.stringify(images));
});

app.post("/deleteuseravatar", jsonParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    if (request.body.avatar !== sanitize(request.body.avatar)) {
        console.error("Malicious avatar name prevented");
        return response.sendStatus(403);
    }

    const fileName = path.join(directories.avatars, sanitize(request.body.avatar));

    if (fs.existsSync(fileName)) {
        fs.rmSync(fileName);
        return response.send({ result: "ok" });
    }

    return response.sendStatus(404);
});

app.post("/setbackground", jsonParser, function (request, response) {
    var bg = "#bg1 {background-image: url('../backgrounds/" + request.body.bg + "');}";
    fs.writeFile(path.join(baseDir, "public", "css", "bg_load.css"), bg, "utf8", function (err) {
        if (err) {
            response.send(err);
            return console.log(err);
        } else {
            //response.redirect("/");
            response.send({ result: "ok" });
        }
    });
});
app.post("/delbackground", jsonParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    if (request.body.bg !== sanitize(request.body.bg)) {
        console.error("Malicious bg name prevented");
        return response.sendStatus(403);
    }

    const fileName = path.join(directories.backgrounds, sanitize(request.body.bg));

    if (!fs.existsSync(fileName)) {
        console.log("BG file not found");
        return response.sendStatus(400);
    }

    fs.rmSync(fileName);
    invalidateThumbnail("bg", request.body.bg);
    return response.send("ok");
});

app.post("/delchat", jsonParser, function (request, response) {
    console.log("/delchat entered");
    if (!request.body) {
        console.log("no request body seen");
        return response.sendStatus(400);
    }

    if (request.body.chatfile !== sanitize(request.body.chatfile)) {
        console.error("Malicious chat name prevented");
        return response.sendStatus(403);
    }

    const dirName = String(request.body.avatar_url).replace(".png", "");
    const fileName = `${directories.chats + dirName}/${sanitize(String(request.body.chatfile))}`;
    const chatFileExists = fs.existsSync(fileName);

    if (!chatFileExists) {
        console.log(`Chat file not found '${fileName}'`);
        return response.sendStatus(400);
    } else {
        console.log("found the chat file: " + fileName);
        /* fs.unlinkSync(fileName); */
        fs.rmSync(fileName);
        console.log("deleted chat file: " + fileName);
    }

    return response.send("ok");
});

app.post("/renamebackground", jsonParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    const oldFileName = path.join(directories.backgrounds, sanitize(request.body.old_bg));
    const newFileName = path.join(directories.backgrounds, sanitize(request.body.new_bg));

    if (!fs.existsSync(oldFileName)) {
        console.log("BG file not found");
        return response.sendStatus(400);
    }

    if (fs.existsSync(newFileName)) {
        console.log("New BG file already exists");
        return response.sendStatus(400);
    }

    fs.renameSync(oldFileName, newFileName);
    invalidateThumbnail("bg", request.body.old_bg);
    return response.send("ok");
});

app.post("/downloadbackground", urlencodedParser, function (request, response) {
    response_dw_bg = response;
    if (!request.body || !request.file) return response.sendStatus(400);

    const img_path = path.join("uploads/", request.file.filename);
    const filename = request.file.originalname;

    try {
        fs.copyFileSync(img_path, path.join(directories.backgrounds, filename));
        invalidateThumbnail("bg", filename);
        response_dw_bg.send(filename);
    } catch (err) {
        console.error(err);
        response_dw_bg.sendStatus(500);
    }
});

app.post("/savesettings", jsonParser, function (request, response) {
    fs.writeFile(
        path.join(baseDir, "public", "settings.json"),
        JSON.stringify(request.body, null, 4),
        "utf8",
        function (err) {
            if (err) {
                response.send(err);
                console.log(err);
            } else {
                response.send({ result: "ok" });
            }
        },
    );
});

function getCharaCardV2(jsonObject) {
    if (jsonObject.spec === undefined) {
        jsonObject = convertToV2(jsonObject);
    } else {
        jsonObject = readFromV2(jsonObject);
    }
    return jsonObject;
}

function readAndParseFromDirectory(directoryPath, fileExtension = ".json") {
    const files = fs
        .readdirSync(directoryPath)
        .filter((x) => path.parse(x).ext == fileExtension)
        .sort();

    const parsedFiles = [];

    files.forEach((item) => {
        try {
            const file = fs.readFileSync(path.join(directoryPath, item), "utf-8");
            parsedFiles.push(fileExtension == ".json" ? json5.parse(file) : file);
        } catch {
            // skip
        }
    });

    return parsedFiles;
}

function sortByModifiedDate(directory: string) {
    return (a, b) =>
        new Date(fs.statSync(`${directory}/${b}`).mtime).getTime() -
        new Date(fs.statSync(`${directory}/${a}`).mtime).getTime();
}

function sortByName() {
    return (a, b) => a.localeCompare(b);
}

function readPresetsFromDirectory(directoryPath, options: any = {}) {
    const sortFunction = options.sortFunction || sortByName();
    const removeFileExtension = options.removeFileExtension || false;

    const files = fs.readdirSync(directoryPath).sort(sortFunction);
    const fileContents = [];
    const fileNames = [];

    files.forEach((item) => {
        try {
            const file = fs.readFileSync(path.join(directoryPath, item), "utf8");
            json5.parse(file);
            fileContents.push(file);
            fileNames.push(removeFileExtension ? item.replace(/\.[^/.]+$/, "") : item);
        } catch {
            // skip
            console.log(`${item} is not a valid JSON`);
        }
    });

    return { fileContents, fileNames };
}

// Wintermute's code
app.post("/getsettings", jsonParser, (request, response) => {
    const settings = fs.readFileSync(path.join(baseDir, "public", "settings.json"), "utf8");

    // OpenAI Settings
    const { fileContents: openai_settings, fileNames: openai_setting_names } = readPresetsFromDirectory(
        directories.openAI_Settings,
        {
            sortFunction: sortByModifiedDate(directories.openAI_Settings),
            removeFileExtension: true,
        },
    );

    // TextGenerationWebUI Settings
    const { fileContents: textgenerationwebui_presets, fileNames: textgenerationwebui_preset_names } =
        readPresetsFromDirectory(directories.textGen_Settings, {
            sortFunction: sortByName(),
            removeFileExtension: true,
        });

    const worldFiles = fs
        .readdirSync(directories.worlds)
        .filter((file) => path.extname(file).toLowerCase() === ".json")
        .sort((a, b) => a.localeCompare(b)); // sort by string comparison

    const world_names = worldFiles.map((item) => path.parse(item).name);

    const themes = readAndParseFromDirectory(directories.themes);
    const quickReplyPresets = readAndParseFromDirectory(directories.quickreplies);

    const context = readAndParseFromDirectory(directories.context);

    response.send({
        settings,
        world_names,
        openai_settings,
        openai_setting_names,
        textgenerationwebui_presets,
        textgenerationwebui_preset_names,
        themes,
        quickReplyPresets,
        context,
        enable_extensions: enableExtensions,
    });
});

app.post("/getworldinfo", jsonParser, (request, response) => {
    if (!request.body?.name) {
        return response.sendStatus(400);
    }

    const file = readWorldInfoFile(request.body.name);

    return response.send(file);
});

app.post("/deleteworldinfo", jsonParser, (request, response) => {
    if (!request.body?.name) {
        return response.sendStatus(400);
    }

    const worldInfoName = request.body.name;
    const filename = sanitize(`${worldInfoName}.json`);
    const pathToWorldInfo = path.join(directories.worlds, filename);

    if (!fs.existsSync(pathToWorldInfo)) {
        throw new Error(`World info file ${filename} doesn't exist.`);
    }

    fs.rmSync(pathToWorldInfo);

    return response.sendStatus(200);
});

app.post("/savetheme", jsonParser, (request, response) => {
    if (!request.body || !request.body.name) {
        return response.sendStatus(400);
    }

    const filename = path.join(directories.themes, sanitize(request.body.name) + ".json");
    fs.writeFileSync(filename, JSON.stringify(request.body, null, 4), "utf8");

    return response.sendStatus(200);
});

app.post("/savequickreply", jsonParser, (request, response) => {
    if (!request.body || !request.body.name) {
        return response.sendStatus(400);
    }

    const filename = path.join(directories.quickreplies, sanitize(request.body.name) + ".json");
    fs.writeFileSync(filename, JSON.stringify(request.body, null, 4), "utf8");

    return response.sendStatus(200);
});

function convertWorldInfoToCharacterBook(name, entries) {
    const result = { entries: [], name };

    for (const index in entries) {
        const entry = entries[index];

        const originalEntry = {
            id: entry.uid,
            keys: entry.key,
            secondary_keys: entry.keysecondary,
            comment: entry.comment,
            content: entry.content,
            constant: entry.constant,
            selective: entry.selective,
            insertion_order: entry.order,
            enabled: !entry.disable,
            position: entry.position == 0 ? "before_char" : "after_char",
            extensions: {
                position: entry.position,
                exclude_recursion: entry.excludeRecursion,
                display_index: entry.displayIndex,
                probability: entry.probability ?? null,
                useProbability: entry.useProbability ?? false,
            },
        };

        result.entries.push(originalEntry);
    }

    return result;
}

function readWorldInfoFile(worldInfoName) {
    if (!worldInfoName) {
        return { entries: {} };
    }

    const filename = `${worldInfoName}.json`;
    const pathToWorldInfo = path.join(directories.worlds, filename);

    if (!fs.existsSync(pathToWorldInfo)) {
        throw new Error(`World info file ${filename} doesn't exist.`);
    }

    const worldInfoText = fs.readFileSync(pathToWorldInfo, "utf8");
    const worldInfo = json5.parse(worldInfoText);
    return worldInfo;
}

function getImages(path) {
    return fs
        .readdirSync(path)
        .filter((file) => {
            const type = mime.lookup(file);
            return type && type.startsWith("image/");
        })
        .sort(Intl.Collator().compare);
}

app.post("/getallchatsofcharacter", jsonParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    var char_dir = request.body.avatar_url.replace(".png", "");
    fs.readdir(directories.chats + char_dir, (err, files) => {
        if (err) {
            console.log("found error in history loading");
            console.error(err);
            response.send({ error: true });
            return;
        }

        // filter for JSON files
        const jsonFiles = files.filter((file) => path.extname(file) === ".jsonl");

        // sort the files by name
        //jsonFiles.sort().reverse();
        // print the sorted file names
        var chatData = {};
        let ii = jsonFiles.length; //this is the number of files belonging to the character
        if (ii !== 0) {
            //console.log('found '+ii+' chat logs to load');
            for (let i = jsonFiles.length - 1; i >= 0; i--) {
                const file = jsonFiles[i];
                const fileStream = fs.createReadStream(directories.chats + char_dir + "/" + file);

                const fullPathAndFile = directories.chats + char_dir + "/" + file;
                const stats = fs.statSync(fullPathAndFile);
                const fileSizeInKB = (stats.size / 1024).toFixed(2) + "kb";

                //console.log(fileSizeInKB);

                const rl = readline.createInterface({
                    input: fileStream,
                    crlfDelay: Infinity,
                });

                let lastLine;
                let itemCounter = 0;
                rl.on("line", (line) => {
                    itemCounter++;
                    lastLine = line;
                });
                rl.on("close", () => {
                    ii--;
                    if (lastLine) {
                        let jsonData = tryParse(lastLine);
                        if (jsonData && (jsonData.name !== undefined || jsonData.character_name !== undefined)) {
                            chatData[i] = {};
                            chatData[i]["file_name"] = file;
                            chatData[i]["file_size"] = fileSizeInKB;
                            chatData[i]["chat_items"] = itemCounter - 1;
                            chatData[i]["mes"] = jsonData["mes"] || "[The chat is empty]";
                            chatData[i]["last_mes"] = jsonData["send_date"] || Date.now();
                        } else {
                            console.log("Found an invalid or corrupted chat file: " + fullPathAndFile);
                        }
                    }
                    if (ii === 0) {
                        //console.log('ii count went to zero, responding with chatData');
                        response.send(chatData);
                    }
                    //console.log('successfully closing getallchatsofcharacter');
                    rl.close();
                });
            }
        } else {
            //console.log('Found No Chats. Exiting Load Routine.');
            response.send({ error: true });
        }
    });
});

function getPngName(file) {
    let i = 1;
    let base_name = file;
    while (fs.existsSync(path.join(directories.characters, file, ".png"))) {
        file = base_name + i;
        i++;
    }
    return file;
}

app.post("/importcharacter", urlencodedParser, async function (request, response) {
    if (!request.body) return response.sendStatus(400);

    let png_name = "";
    let filedata = request.file;
    let uploadPath = path.join(baseDir, "uploads", filedata.filename);
    var format = request.body.file_type;
    const defaultAvatarPath = path.join(baseDir, "public", "img", "ai4.png");
    //console.log(format);
    if (filedata) {
        if (format == "json") {
            fs.readFile(uploadPath, "utf8", async (err, data) => {
                if (err) {
                    console.log(err);
                    response.send({ error: true });
                }

                let jsonData = json5.parse(data);

                if (jsonData.spec !== undefined) {
                    console.log("importing from v2 json");
                    unsetFavFlag(jsonData);
                    jsonData = readFromV2(jsonData);
                    png_name = getPngName(jsonData.data?.name || jsonData.name);
                    let char = JSON.stringify(jsonData);
                    charaWrite(defaultAvatarPath, char, png_name, response, { file_name: png_name });
                } else if (jsonData.name !== undefined) {
                    console.log("importing from v1 json");
                    jsonData.name = sanitize(jsonData.name);
                    if (jsonData.creator_notes) {
                        jsonData.creator_notes = jsonData.creator_notes.replace("Creator's notes go here.", "");
                    }
                    png_name = getPngName(jsonData.name);
                    let char = {
                        name: jsonData.name,
                        description: jsonData.description ?? "",
                        creatorcomment: jsonData.creatorcomment ?? jsonData.creator_notes ?? "",
                        personality: jsonData.personality ?? "",
                        first_mes: jsonData.first_mes ?? "",
                        avatar: "none",
                        chat: jsonData.name + " - " + humanizedISO8601DateTime(),
                        mes_example: jsonData.mes_example ?? "",
                        scenario: jsonData.scenario ?? "",
                        create_date: humanizedISO8601DateTime(),
                        talkativeness: jsonData.talkativeness ?? 0.5,
                        creator: jsonData.creator ?? "",
                        tags: jsonData.tags ?? "",
                    };
                    char = convertToV2(char);
                    char = JSON.stringify(char);
                    charaWrite(defaultAvatarPath, char, png_name, response, { file_name: png_name });
                } else if (jsonData.char_name !== undefined) {
                    //json Pygmalion notepad
                    console.log("importing from gradio json");
                    jsonData.char_name = sanitize(jsonData.char_name);
                    if (jsonData.creator_notes) {
                        jsonData.creator_notes = jsonData.creator_notes.replace("Creator's notes go here.", "");
                    }
                    png_name = getPngName(jsonData.char_name);
                    let char = {
                        name: jsonData.char_name,
                        description: jsonData.char_persona ?? "",
                        creatorcomment: jsonData.creatorcomment ?? jsonData.creator_notes ?? "",
                        personality: "",
                        first_mes: jsonData.char_greeting ?? "",
                        avatar: "none",
                        chat: jsonData.name + " - " + humanizedISO8601DateTime(),
                        mes_example: jsonData.example_dialogue ?? "",
                        scenario: jsonData.world_scenario ?? "",
                        create_date: humanizedISO8601DateTime(),
                        talkativeness: jsonData.talkativeness ?? 0.5,
                        creator: jsonData.creator ?? "",
                        tags: jsonData.tags ?? "",
                    };
                    char = convertToV2(char);
                    char = JSON.stringify(char);
                    charaWrite(defaultAvatarPath, char, png_name, response, { file_name: png_name });
                } else {
                    console.log("Incorrect character format .json");
                    response.send({ error: true });
                }
            });
        } else {
            try {
                var img_data = await charaRead(uploadPath, format);
                let jsonData = json5.parse(img_data);

                jsonData.name = sanitize(jsonData.data?.name || jsonData.name);
                png_name = getPngName(jsonData.name);

                if (jsonData.spec !== undefined) {
                    console.log("Found a v2 character file.");
                    unsetFavFlag(jsonData);
                    jsonData = readFromV2(jsonData);
                    let char = JSON.stringify(jsonData);
                    charaWrite(uploadPath, char, png_name, response, {
                        file_name: png_name,
                    });
                } else if (jsonData.name !== undefined) {
                    console.log("Found a v1 character file.");

                    if (jsonData.creator_notes) {
                        jsonData.creator_notes = jsonData.creator_notes.replace("Creator's notes go here.", "");
                    }

                    let char = {
                        name: jsonData.name,
                        description: jsonData.description ?? "",
                        creatorcomment: jsonData.creatorcomment ?? jsonData.creator_notes ?? "",
                        personality: jsonData.personality ?? "",
                        first_mes: jsonData.first_mes ?? "",
                        avatar: "none",
                        chat: jsonData.name + " - " + humanizedISO8601DateTime(),
                        mes_example: jsonData.mes_example ?? "",
                        scenario: jsonData.scenario ?? "",
                        create_date: humanizedISO8601DateTime(),
                        talkativeness: jsonData.talkativeness ?? 0.5,
                        creator: jsonData.creator ?? "",
                        tags: jsonData.tags ?? "",
                    };
                    char = convertToV2(char);
                    char = JSON.stringify(char);
                    await charaWrite(uploadPath, char, png_name, response, {
                        file_name: png_name,
                    });
                } else {
                    console.log("Unknown character card format");
                    response.send({ error: true });
                }
            } catch (err) {
                console.log(err);
                response.send({ error: true });
            }
        }
    }
});

app.post("/dupecharacter", jsonParser, async function (request, response) {
    try {
        if (!request.body.avatar_url) {
            console.log("avatar URL not found in request body");
            console.log(request.body);
            return response.sendStatus(400);
        }
        let filename = path.join(directories.characters, sanitize(request.body.avatar_url));
        if (!fs.existsSync(filename)) {
            console.log("file for dupe not found");
            console.log(filename);
            return response.sendStatus(404);
        }
        let suffix = 1;
        let newFilename = filename;
        while (fs.existsSync(newFilename)) {
            let suffixStr = "_" + suffix;
            let ext = path.extname(filename);
            newFilename = filename.slice(0, -ext.length) + suffixStr + ext;
            suffix++;
        }
        fs.copyFile(filename, newFilename, (err) => {
            if (err) throw err;
            console.log(`${filename} was copied to ${newFilename}`);
            response.sendStatus(200);
        });
    } catch (error) {
        console.error(error);
        return response.send({ error: true });
    }
});

app.post("/exportchat", jsonParser, async function (request, response) {
    if (!request.body.file || (!request.body.avatar_url && request.body.is_group === false)) {
        return response.sendStatus(400);
    }
    const pathToFolder = request.body.is_group
        ? directories.groupChats
        : path.join(directories.chats, String(request.body.avatar_url).replace(".png", ""));
    let filename = path.join(pathToFolder, request.body.file);
    let exportfilename = request.body.exportfilename;
    if (!fs.existsSync(filename)) {
        const errorMessage = {
            message: `Could not find JSONL file to export. Source chat file: ${filename}.`,
        };
        console.log(errorMessage.message);
        return response.status(404).json(errorMessage);
    }
    try {
        // Short path for JSONL files
        if (request.body.format == "jsonl") {
            try {
                const rawFile = fs.readFileSync(filename, "utf8");
                const successMessage = {
                    message: `Chat saved to ${exportfilename}`,
                    result: rawFile,
                };

                console.log(`Chat exported as ${exportfilename}`);
                return response.status(200).json(successMessage);
            } catch (err) {
                console.error(err);
                const errorMessage = {
                    message: `Could not read JSONL file to export. Source chat file: ${filename}.`,
                };
                console.log(errorMessage.message);
                return response.status(500).json(errorMessage);
            }
        }

        const readStream = fs.createReadStream(filename);
        const rl = readline.createInterface({
            input: readStream,
        });
        let buffer = "";
        rl.on("line", (line) => {
            const data = JSON.parse(line);
            if (data.mes) {
                const name = data.name;
                const message = (data?.extra?.display_text || data?.mes || "").replace(/\r?\n/g, "\n");
                buffer += `${name}: ${message}\n\n`;
            }
        });
        rl.on("close", () => {
            const successMessage = {
                message: `Chat saved to ${exportfilename}`,
                result: buffer,
            };
            console.log(`Chat exported as ${exportfilename}`);
            return response.status(200).json(successMessage);
        });
    } catch (err) {
        console.log("chat export failed.");
        console.log(err);
        return response.sendStatus(400);
    }
});

app.post("/exportcharacter", jsonParser, async function (request, response) {
    if (!request.body.format || !request.body.avatar_url) {
        return response.sendStatus(400);
    }

    let filename = path.join(directories.characters, sanitize(request.body.avatar_url));

    if (!fs.existsSync(filename)) {
        return response.sendStatus(404);
    }

    switch (request.body.format) {
        case "png":
            return response.sendFile(filename, { root: directories.characters });
        case "json": {
            try {
                let json = await charaRead(filename);
                let jsonObject = getCharaCardV2(json5.parse(json));
                return response.type("json").send(jsonObject);
            } catch {
                return response.sendStatus(400);
            }
        }
    }

    return response.sendStatus(400);
});

app.post("/importgroupchat", urlencodedParser, function (request, response) {
    try {
        const filedata = request.file;
        const chatname = humanizedISO8601DateTime();
        fs.copyFileSync(
            path.join(directories.uploads, filedata.filename),
            path.join(directories.groupChats, chatname + ".jsonl"),
        );
        return response.send({ res: chatname });
    } catch (error) {
        console.error(error);
        return response.send({ error: true });
    }
});

app.post("/importchat", urlencodedParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    var format = request.body.file_type;
    let filedata = request.file;
    let avatar_url = request.body.avatar_url.replace(".png", "");
    let ch_name = request.body.character_name;
    let user_name = request.body.user_name || "You";

    if (filedata) {
        if (format === "json") {
            fs.readFile(`./uploads/${filedata.filename}`, "utf8", (err, data) => {
                if (err) {
                    console.log(err);
                    response.send({ error: true });
                }

                const jsonData = json5.parse(data);
                if (jsonData.histories !== undefined) {
                    //console.log('/importchat confirms JSON histories are defined');
                    const chat = {
                        from(history) {
                            return [
                                {
                                    user_name: user_name,
                                    character_name: ch_name,
                                    create_date: humanizedISO8601DateTime(),
                                },
                                ...history.msgs.map((message) => ({
                                    name: message.src.is_human ? user_name : ch_name,
                                    is_user: message.src.is_human,
                                    is_name: true,
                                    send_date: humanizedISO8601DateTime(),
                                    mes: message.text,
                                })),
                            ];
                        },
                    };

                    const newChats = [];
                    (jsonData.histories.histories ?? []).forEach((history) => {
                        newChats.push(chat.from(history));
                    });

                    const errors = [];
                    newChats.forEach((chat) =>
                        fs.writeFile(
                            `${
                                directories.chats + avatar_url
                            }/${ch_name} - ${humanizedISO8601DateTime()} imported.jsonl`,
                            chat.map(JSON.stringify).join("\n"),
                            "utf8",
                            (err) => err ?? errors.push(err),
                        ),
                    );

                    if (0 < errors.length) {
                        response.send(
                            "Errors occurred while writing character files. Errors: " + JSON.stringify(errors),
                        );
                    }

                    response.send({ res: true });
                } else if (Array.isArray(jsonData.data_visible)) {
                    // oobabooga's format
                    const chat = [
                        {
                            user_name: user_name,
                            character_name: ch_name,
                            create_date: humanizedISO8601DateTime(),
                        },
                    ];

                    for (const arr of jsonData.data_visible) {
                        if (arr[0]) {
                            const userMessage = {
                                name: user_name,
                                is_user: true,
                                is_name: true,
                                send_date: humanizedISO8601DateTime(),
                                mes: arr[0],
                            };
                            chat.push(userMessage);
                        }
                        if (arr[1]) {
                            const charMessage = {
                                name: ch_name,
                                is_user: false,
                                is_name: true,
                                send_date: humanizedISO8601DateTime(),
                                mes: arr[1],
                            };
                            chat.push(charMessage);
                        }
                    }

                    fs.writeFileSync(
                        `${directories.chats + avatar_url}/${ch_name} - ${humanizedISO8601DateTime()} imported.jsonl`,
                        chat.map(JSON.stringify).join("\n"),
                        "utf8",
                    );

                    response.send({ res: true });
                } else {
                    response.send({ error: true });
                }
            });
        }
        if (format === "jsonl") {
            //console.log(humanizedISO8601DateTime()+':imported chat format is JSONL');
            const fileStream = fs.createReadStream("./uploads/" + filedata.filename);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity,
            });

            rl.once("line", (line) => {
                let jsonData = json5.parse(line);

                if (jsonData.user_name !== undefined || jsonData.name !== undefined) {
                    fs.copyFile(
                        `./uploads/${filedata.filename}`,
                        `${directories.chats + avatar_url}/${ch_name} - ${humanizedISO8601DateTime()}.jsonl`,
                        (err) => {
                            if (err) {
                                response.send({ error: true });
                                return console.log(err);
                            } else {
                                response.send({ res: true });
                                return;
                            }
                        },
                    );
                } else {
                    response.send({ error: true });
                    return;
                }
                rl.close();
            });
        }
    }
});

app.post("/importworldinfo", urlencodedParser, (request, response) => {
    if (!request.file) return response.sendStatus(400);

    const filename = `${path.parse(sanitize(request.file.originalname)).name}.json`;

    let fileContents = null;

    if (request.body.convertedData) {
        fileContents = request.body.convertedData;
    } else {
        const pathToUpload = path.join("./uploads/", request.file.filename);
        fileContents = fs.readFileSync(pathToUpload, "utf8");
    }

    try {
        const worldContent = json5.parse(fileContents);
        if (!("entries" in worldContent)) {
            throw new Error("File must contain a world info entries list");
        }
    } catch (err) {
        return response.status(400).send("Is not a valid world info file");
    }

    const pathToNewFile = path.join(directories.worlds, filename);
    const worldName = path.parse(pathToNewFile).name;

    if (!worldName) {
        return response.status(400).send("World file must have a name");
    }

    fs.writeFileSync(pathToNewFile, fileContents);
    return response.send({ name: worldName });
});

app.post("/editworldinfo", jsonParser, (request, response) => {
    if (!request.body) {
        return response.sendStatus(400);
    }

    if (!request.body.name) {
        return response.status(400).send("World file must have a name");
    }

    try {
        if (!("entries" in request.body.data)) {
            throw new Error("World info must contain an entries list");
        }
    } catch (err) {
        return response.status(400).send("Is not a valid world info file");
    }

    const filename = `${sanitize(request.body.name)}.json`;
    const pathToFile = path.join(directories.worlds, filename);

    fs.writeFileSync(pathToFile, JSON.stringify(request.body.data, null, 4));

    return response.send({ ok: true });
});

app.post("/uploaduseravatar", urlencodedParser, async (request, response) => {
    if (!request.file) return response.sendStatus(400);

    try {
        const pathToUpload = path.join("./uploads/" + request.file.filename);
        const crop = tryParse(request.query.crop);
        let rawImg = await jimp.read(pathToUpload);

        if (typeof crop == "object" && [crop.x, crop.y, crop.width, crop.height].every((x) => typeof x === "number")) {
            rawImg = rawImg.crop(crop.x, crop.y, crop.width, crop.height);
        }

        const image = await rawImg.cover(AVATAR_WIDTH, AVATAR_HEIGHT).getBufferAsync(jimp.MIME_PNG);

        const filename = request.body.overwrite_name || `${Date.now()}.png`;
        const pathToNewFile = path.join(directories.avatars, filename);
        fs.writeFileSync(pathToNewFile, image);
        fs.rmSync(pathToUpload);
        return response.send({ path: filename });
    } catch (err) {
        return response.status(400).send("Is not a valid image");
    }
});

app.post("/getgroups", jsonParser, (_, response) => {
    const groups = [];

    if (!fs.existsSync(directories.groups)) {
        fs.mkdirSync(directories.groups);
    }

    const files = fs.readdirSync(directories.groups).filter((x) => path.extname(x) === ".json");
    const chats = fs.readdirSync(directories.groupChats).filter((x) => path.extname(x) === ".jsonl");

    files.forEach(function (file) {
        try {
            const filePath = path.join(directories.groups, file);
            const fileContents = fs.readFileSync(filePath, "utf8");
            const group = json5.parse(fileContents);
            const groupStat = fs.statSync(filePath);
            group["date_added"] = groupStat.birthtimeMs;

            let chat_size = 0;
            let date_last_chat = 0;

            if (Array.isArray(group.chats) && Array.isArray(chats)) {
                for (const chat of chats) {
                    if (group.chats.includes(path.parse(chat).name)) {
                        const chatStat = fs.statSync(path.join(directories.groupChats, chat));
                        chat_size += chatStat.size;
                        date_last_chat = Math.max(date_last_chat, chatStat.mtimeMs);
                    }
                }
            }

            group["date_last_chat"] = date_last_chat;
            group["chat_size"] = chat_size;
            groups.push(group);
        } catch (error) {
            console.error(error);
        }
    });

    return response.send(groups);
});

app.post("/creategroup", jsonParser, (request, response) => {
    if (!request.body) {
        return response.sendStatus(400);
    }

    const id = Date.now();
    const groupMetadata = {
        id: id,
        name: request.body.name ?? "New Group",
        members: request.body.members ?? [],
        avatar_url: request.body.avatar_url,
        allow_self_responses: !!request.body.allow_self_responses,
        activation_strategy: request.body.activation_strategy ?? 0,
        disabled_members: request.body.disabled_members ?? [],
        chat_metadata: request.body.chat_metadata ?? {},
        fav: request.body.fav,
        chat_id: request.body.chat_id ?? id,
        chats: request.body.chats ?? [id],
    };
    const pathToFile = path.join(directories.groups, `${id}.json`);
    const fileData = JSON.stringify(groupMetadata);

    if (!fs.existsSync(directories.groups)) {
        fs.mkdirSync(directories.groups);
    }

    fs.writeFileSync(pathToFile, fileData);
    return response.send(groupMetadata);
});

app.post("/editgroup", jsonParser, (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }
    const id = request.body.id;
    const pathToFile = path.join(directories.groups, `${id}.json`);
    const fileData = JSON.stringify(request.body);

    fs.writeFileSync(pathToFile, fileData);
    return response.send({ ok: true });
});

app.post("/getgroupchat", jsonParser, (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }

    const id = request.body.id;
    const pathToFile = path.join(directories.groupChats, `${id}.jsonl`);

    if (fs.existsSync(pathToFile)) {
        const data = fs.readFileSync(pathToFile, "utf8");
        const lines = data.split("\n");

        // Iterate through the array of strings and parse each line as JSON
        const jsonData = lines.map(json5.parse);
        return response.send(jsonData);
    } else {
        return response.send([]);
    }
});

app.post("/deletegroupchat", jsonParser, (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }

    const id = request.body.id;
    const pathToFile = path.join(directories.groupChats, `${id}.jsonl`);

    if (fs.existsSync(pathToFile)) {
        fs.rmSync(pathToFile);
        return response.send({ ok: true });
    }

    return response.send({ error: true });
});

app.post("/savegroupchat", jsonParser, (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }

    const id = request.body.id;
    const pathToFile = path.join(directories.groupChats, `${id}.jsonl`);

    if (!fs.existsSync(directories.groupChats)) {
        fs.mkdirSync(directories.groupChats);
    }

    let chat_data = request.body.chat;
    let jsonlData = chat_data.map(JSON.stringify).join("\n");
    fs.writeFileSync(pathToFile, jsonlData, "utf8");
    return response.send({ ok: true });
});

app.post("/deletegroup", jsonParser, async (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }

    const id = request.body.id;
    const pathToGroup = path.join(directories.groups, sanitize(`${id}.json`));

    try {
        // Delete group chats
        const group = json5.parse(fs.readFileSync(pathToGroup));

        if (group && Array.isArray(group.chats)) {
            for (const chat of group.chats) {
                console.log("Deleting group chat", chat);
                const pathToFile = path.join(directories.groupChats, `${id}.jsonl`);

                if (fs.existsSync(pathToFile)) {
                    fs.rmSync(pathToFile);
                }
            }
        }
    } catch (error) {
        console.error("Could not delete group chats. Clean them up manually.", error);
    }

    if (fs.existsSync(pathToGroup)) {
        fs.rmSync(pathToGroup);
    }

    return response.send({ ok: true });
});

/**
 * Discover the extension folders
 * If the folder is called third-party, search for subfolders instead
 */
app.get("/discover_extensions", jsonParser, function (_, response) {
    // get all folders in the extensions folder, except third-party
    const extensions = fs
        .readdirSync(directories.extensions)
        .filter((f) => fs.statSync(path.join(directories.extensions, f)).isDirectory())
        .filter((f) => f !== "third-party");

    // get all folders in the third-party folder, if it exists

    if (!fs.existsSync(path.join(directories.extensions, "third-party"))) {
        return response.send(extensions);
    }

    const thirdPartyExtensions = fs
        .readdirSync(path.join(directories.extensions, "third-party"))
        .filter((f) => fs.statSync(path.join(directories.extensions, "third-party", f)).isDirectory());

    // add the third-party extensions to the extensions array
    extensions.push(...thirdPartyExtensions.map((f) => `third-party/${f}`));
    console.log(extensions);

    return response.send(extensions);
});

app.get("/get_sprites", jsonParser, function (request, response) {
    const name = request.query.name.toString();
    const spritesPath = path.join(directories.characters, name);
    let sprites = [];

    try {
        if (fs.existsSync(spritesPath) && fs.statSync(spritesPath).isDirectory()) {
            sprites = fs
                .readdirSync(spritesPath)
                .filter((file) => {
                    const mimeType = mime.lookup(file);
                    return mimeType && mimeType.startsWith("image/");
                })
                .map((file) => {
                    const pathToSprite = path.join(spritesPath, file);
                    return {
                        label: path.parse(pathToSprite).name.toLowerCase(),
                        path: `/characters/${name}/${file}`,
                    };
                });
        }
    } catch (err) {
        console.log(err);
    } finally {
        return response.send(sprites);
    }
});

function getThumbnailFolder(type) {
    let thumbnailFolder;

    switch (type) {
        case "bg":
            thumbnailFolder = directories.thumbnailsBg;
            break;
        case "avatar":
            thumbnailFolder = directories.thumbnailsAvatar;
            break;
    }

    return thumbnailFolder;
}

function getOriginalFolder(type) {
    let originalFolder;

    switch (type) {
        case "bg":
            originalFolder = directories.backgrounds;
            break;
        case "avatar":
            originalFolder = directories.characters;
            break;
    }

    return originalFolder;
}

function invalidateThumbnail(type, file) {
    const folder = getThumbnailFolder(type);
    const pathToThumbnail = path.join(folder, file);

    if (fs.existsSync(pathToThumbnail)) {
        fs.rmSync(pathToThumbnail);
    }
}

async function ensureThumbnailCache() {
    const cacheFiles = fs.readdirSync(directories.thumbnailsBg);

    // files exist, all ok
    if (cacheFiles.length) {
        return;
    }

    console.log("Generating thumbnails cache. Please wait...");

    const bgFiles = fs.readdirSync(directories.backgrounds);
    const tasks = [];

    for (const file of bgFiles) {
        tasks.push(generateThumbnail("bg", file));
    }

    await Promise.all(tasks);
    console.log(`Done! Generated: ${bgFiles.length} preview images`);
}

async function generateThumbnail(type, file) {
    const pathToCachedFile = path.join(getThumbnailFolder(type), file);
    const pathToOriginalFile = path.join(getOriginalFolder(type), file);

    const cachedFileExists = fs.existsSync(pathToCachedFile);
    const originalFileExists = fs.existsSync(pathToOriginalFile);

    // to handle cases when original image was updated after thumb creation
    let shouldRegenerate = false;

    if (cachedFileExists && originalFileExists) {
        const originalStat = fs.statSync(pathToOriginalFile);
        const cachedStat = fs.statSync(pathToCachedFile);

        if (originalStat.mtimeMs > cachedStat.ctimeMs) {
            //console.log('Original file changed. Regenerating thumbnail...');
            shouldRegenerate = true;
        }
    }

    if (cachedFileExists && !shouldRegenerate) {
        return pathToCachedFile;
    }

    if (!originalFileExists) {
        return null;
    }

    const imageSizes = { bg: [160, 90], avatar: [96, 144] };
    const mySize = imageSizes[type];

    try {
        let buffer;

        try {
            const image = await jimp.read(pathToOriginalFile);
            buffer = await image.cover(mySize[0], mySize[1]).quality(95).getBufferAsync(mime.lookup("jpg"));
        } catch (inner) {
            console.warn(`Thumbnailer can not process the image: ${pathToOriginalFile}. Using original size`);
            buffer = fs.readFileSync(pathToOriginalFile);
        }

        fs.writeFileSync(pathToCachedFile, buffer);
    } catch (outer) {
        return null;
    }

    return pathToCachedFile;
}

app.get("/thumbnail", jsonParser, async function (request, response) {
    const type = request.query.type;
    const file = sanitize(request.query.file.toString());

    if (!type || !file) {
        return response.sendStatus(400);
    }

    if (!(type == "bg" || type == "avatar")) {
        return response.sendStatus(400);
    }

    if (sanitize(file) !== file) {
        console.error("Malicious filename prevented");
        return response.sendStatus(403);
    }

    if (config.disableThumbnails == true) {
        const pathToOriginalFile = path.join(getOriginalFolder(type), file);
        return response.sendFile(pathToOriginalFile);
    }

    const pathToCachedFile = await generateThumbnail(type, file);

    if (!pathToCachedFile) {
        return response.sendStatus(404);
    }

    return response.sendFile(pathToCachedFile);
});

/* OpenAI */
app.post("/getstatus_openai", jsonParser, function (request, response_getstatus_openai) {
    if (!request.body) return response_getstatus_openai.sendStatus(400);

    let api_url: string;
    let api_key_openai: string;
    let headers: { "HTTP-Referer"?: string };

    if (request.body.use_openrouter == false) {
        api_url = new URL(request.body.reverse_proxy || api_openai).toString();
        api_key_openai = request.body.reverse_proxy ? request.body.proxy_password : readSecret(SECRET_KEYS.OPENAI);
        headers = {};
    } else {
        api_url = "https://openrouter.ai/api/v1";
        api_key_openai = readSecret(SECRET_KEYS.OPENROUTER);
        // OpenRouter needs to pass the referer: https://openrouter.ai/docs
        headers = { "HTTP-Referer": request.headers.referer };
    }

    if (!api_key_openai && !request.body.reverse_proxy) {
        return response_getstatus_openai.status(401).send({ error: true });
    }

    const args = {
        headers: {
            Authorization: "Bearer " + api_key_openai,
            ...headers,
        },
    };
    client
        .get(api_url + "/models", args, function (data, response) {
            if (response.statusCode == 200) {
                response_getstatus_openai.send(data);
                if (request.body.use_openrouter) {
                    let models = [];
                    data.data.forEach(
                        (model: { context_length: any; pricing: { prompt: number }; id: string | number }) => {
                            const context_length = model.context_length;
                            const tokens_dollar = parseFloat(1 / (1000 * model.pricing.prompt));
                            const tokens_rounded = (Math.round(tokens_dollar * 1000) / 1000).toFixed(0);
                            models[model.id] = {
                                tokens_per_dollar: tokens_rounded + "k",
                                context_length: context_length,
                            };
                        },
                    );
                    console.log("Available OpenRouter models:", models);
                } else {
                    const modelIds = data?.data?.map((x) => x.id)?.sort();
                    console.log("Available OpenAI models:", modelIds);
                }
            }
            if (response.statusCode == 401) {
                console.log("Access Token is incorrect.");
                response_getstatus_openai.send({ error: true });
            }
            if (response.statusCode == 404) {
                console.log("Endpoint not found.");
                response_getstatus_openai.send({ error: true });
            }
            if (
                response.statusCode == 500 ||
                response.statusCode == 501 ||
                response.statusCode == 501 ||
                response.statusCode == 503 ||
                response.statusCode == 507
            ) {
                console.log(data);
                response_getstatus_openai.send({ error: true });
            }
        })
        .on("error", function () {
            response_getstatus_openai.send({ error: true });
        });
});

app.post("/openai_bias", jsonParser, async function (request, response) {
    if (!request.body || !Array.isArray(request.body)) return response.sendStatus(400);

    let result = {};

    const model = getTokenizerModel(String(request.query.model || ""));

    // no bias for claude
    if (model == "claude") {
        return response.send(result);
    }

    const tokenizer = getTiktokenTokenizer(model);

    for (const entry of request.body) {
        if (!entry || !entry.text) {
            continue;
        }

        try {
            const tokens = tokenizer.encode(entry.text);

            for (const token of tokens) {
                result[token] = entry.value;
            }
        } catch {
            console.warn("Tokenizer failed to encode:", entry.text);
        }
    }

    // not needed for cached tokenizers
    //tokenizer.free();
    return response.send(result);
});

app.post("/deletepreset_openai", jsonParser, function (request, response) {
    if (!request.body || !request.body.name) {
        return response.sendStatus(400);
    }

    const name = request.body.name;
    const pathToFile = path.join(directories.openAI_Settings, `${name}.settings`);

    if (fs.existsSync(pathToFile)) {
        fs.rmSync(pathToFile);
        return response.send({ ok: true });
    }

    return response.send({ error: true });
});

function convertChatMLPrompt(messages) {
    const messageStrings = [];
    messages.forEach((m) => {
        if (m.role === "system" && m.name === undefined) {
            messageStrings.push("System: " + m.content);
        } else if (m.role === "system" && m.name !== undefined) {
            messageStrings.push(m.name + ": " + m.content);
        } else {
            messageStrings.push(m.role + ": " + m.content);
        }
    });
    return messageStrings.join("\n");
}

// Prompt Conversion script taken from RisuAI by @kwaroran (GPLv3).
function convertClaudePrompt(messages, addHumanPrefix, addAssistantPostfix) {
    // Claude doesn't support message names, so we'll just add them to the message content.
    for (const message of messages) {
        if (message.name && message.role !== "system") {
            message.content = message.name + ": " + message.content;
            delete message.name;
        }
    }

    let requestPrompt = messages
        .map((v) => {
            let prefix = "";
            switch (v.role) {
                case "assistant":
                    prefix = "\n\nAssistant: ";
                    break;
                case "user":
                    prefix = "\n\nHuman: ";
                    break;
                case "system":
                    // According to the Claude docs, H: and A: should be used for example conversations.
                    if (v.name === "example_assistant") {
                        prefix = "\n\nA: ";
                    } else if (v.name === "example_user") {
                        prefix = "\n\nH: ";
                    } else {
                        prefix = "\n\n";
                    }
                    break;
            }
            return prefix + v.content;
        })
        .join("");

    if (addHumanPrefix) {
        requestPrompt = "\n\nHuman: " + requestPrompt;
    }

    if (addAssistantPostfix) {
        requestPrompt = requestPrompt + "\n\nAssistant: ";
    }

    return requestPrompt;
}

async function sendClaudeRequest(request, response) {
    const api_url = new URL(request.body.reverse_proxy || api_claude).toString();
    const api_key_claude = request.body.reverse_proxy ? request.body.proxy_password : readSecret(SECRET_KEYS.CLAUDE);

    if (!api_key_claude) {
        return response.status(401).send({ error: true });
    }

    try {
        const controller = new AbortController();
        request.socket.removeAllListeners("close");
        request.socket.on("close", function () {
            controller.abort();
        });

        let requestPrompt = convertClaudePrompt(request.body.messages, true, !request.body.exclude_assistant);

        if (request.body.assistant_prefill && !request.body.exclude_assistant) {
            requestPrompt += request.body.assistant_prefill;
        }

        console.log("Claude request:", requestPrompt);

        const generateResponse = await fetch(api_url + "/complete", {
            method: "POST",
            signal: controller.signal,
            body: JSON.stringify({
                prompt: requestPrompt,
                model: request.body.model,
                max_tokens_to_sample: request.body.max_tokens,
                stop_sequences: ["\n\nHuman:", "\n\nSystem:", "\n\nAssistant:"],
                temperature: request.body.temperature,
                top_p: request.body.top_p,
                top_k: request.body.top_k,
                stream: request.body.stream,
            }),
            headers: {
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01",
                "x-api-key": api_key_claude,
            },
            timeout: 0,
        });

        if (request.body.stream) {
            // Pipe remote SSE stream to Express response
            generateResponse.body.pipe(response);

            request.socket.on("close", function () {
                generateResponse.body.destroy(); // Close the remote stream
                response.end(); // End the Express response
            });

            generateResponse.body.on("end", function () {
                console.log("Streaming request finished");
                response.end();
            });
        } else {
            if (!generateResponse.ok) {
                console.log(
                    `Claude API returned error: ${generateResponse.status} ${
                        generateResponse.statusText
                    } ${await generateResponse.text()}`,
                );
                return response.status(generateResponse.status).send({ error: true });
            }

            const generateResponseJson = await generateResponse.json();
            const responseText = generateResponseJson.completion;
            console.log("Claude response:", responseText);

            // Wrap it back to OAI format
            const reply = { choices: [{ message: { content: responseText } }] };
            return response.send(reply);
        }
    } catch (error) {
        console.log("Error communicating with Claude: ", error);
        if (!response.headersSent) {
            return response.status(500).send({ error: true });
        }
    }
}

app.post("/generate_openai", jsonParser, function (request, response_generate_openai) {
    if (!request.body) return response_generate_openai.status(400).send({ error: true });

    if (request.body.use_claude) {
        return sendClaudeRequest(request, response_generate_openai);
    }

    let api_url;
    let api_key_openai;
    let headers;
    let bodyParams;

    if (!request.body.use_openrouter) {
        api_url = new URL(request.body.reverse_proxy || api_openai).toString();
        api_key_openai = request.body.reverse_proxy ? request.body.proxy_password : readSecret(SECRET_KEYS.OPENAI);
        headers = {};
        bodyParams = {};
    } else {
        api_url = "https://openrouter.ai/api/v1";
        api_key_openai = readSecret(SECRET_KEYS.OPENROUTER);
        // OpenRouter needs to pass the referer: https://openrouter.ai/docs
        headers = { "HTTP-Referer": request.headers.referer };
        bodyParams = { transforms: ["middle-out"] };
    }

    if (!api_key_openai && !request.body.reverse_proxy) {
        return response_generate_openai.status(401).send({ error: true });
    }

    const isTextCompletion = Boolean(
        request.body.model && (request.body.model.startsWith("text-") || request.body.model.startsWith("code-")),
    );
    const textPrompt = isTextCompletion ? convertChatMLPrompt(request.body.messages) : "";
    const endpointUrl = isTextCompletion ? `${api_url}/completions` : `${api_url}/chat/completions`;

    const controller = new AbortController();
    request.socket.removeAllListeners("close");
    request.socket.on("close", function () {
        controller.abort();
    });

    var config = {
        method: "post",
        url: endpointUrl,
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + api_key_openai,
            ...headers,
        },
        data: {
            messages: isTextCompletion === false ? request.body.messages : undefined,
            prompt: isTextCompletion === true ? textPrompt : undefined,
            model: request.body.model,
            temperature: request.body.temperature,
            max_tokens: request.body.max_tokens,
            stream: request.body.stream,
            presence_penalty: request.body.presence_penalty,
            frequency_penalty: request.body.frequency_penalty,
            top_p: request.body.top_p,
            top_k: request.body.top_k,
            stop: request.body.stop,
            logit_bias: request.body.logit_bias,
            ...bodyParams,
        },
        signal: controller.signal,
        responseType: "json",
    };

    console.log(config.data);

    if (request.body.stream) {
        config.responseType = "stream";
    }

    async function makeRequest(config, response_generate_openai, request, retries = 5, timeout = 1000) {
        try {
            const response = await axios(config);

            if (response.status <= 299) {
                if (request.body.stream) {
                    console.log("Streaming request in progress");
                    response.data.pipe(response_generate_openai);
                    response.data.on("end", () => {
                        console.log("Streaming request finished");
                        response_generate_openai.end();
                    });
                } else {
                    response_generate_openai.send(response.data);
                    console.log(response.data);
                    console.log(response.data?.choices[0]?.message);
                }
            } else {
                handleErrorResponse(response, response_generate_openai);
            }
        } catch (error) {
            if (error.response && error.response.status === 429 && retries > 0) {
                console.log("Out of quota, retrying...");
                setTimeout(() => {
                    makeRequest(config, response_generate_openai, request, retries - 1);
                }, timeout);
            } else {
                let errorData = error?.response?.data;

                if (request.body.stream) {
                    try {
                        const chunks = await readAllChunks(errorData);
                        const blob = new Blob(chunks, {
                            type: "application/json",
                        });
                        const text = await blob.text();
                        errorData = JSON.parse(text);
                    } catch {
                        console.warn("Error parsing streaming response");
                    }
                } else {
                    errorData = typeof errorData === "string" ? tryParse(errorData) : errorData;
                }

                handleError(error, response_generate_openai, errorData);
            }
        }
    }

    function handleErrorResponse(response, response_generate_openai) {
        if (response.status >= 400 && response.status <= 504) {
            console.log("Error occurred:", response.status, response.data);
            response_generate_openai.send({ error: true });
        }
    }

    function handleError(error, response_generate_openai, errorData) {
        console.error("Error:", error?.message);

        let message = error?.response?.statusText;

        const statusMessages = {
            400: "Bad request",
            401: "Unauthorized",
            402: "Credit limit reached",
            403: "Forbidden",
            404: "Not found",
            429: "Too many requests",
            451: "Unavailable for legal reasons",
        };

        const status = error?.response?.status;
        if (statusMessages.hasOwnProperty(status)) {
            message = errorData?.error?.message || statusMessages[status];
            console.log(message);
        }

        const quota_error = error?.response?.status === 429 && errorData?.error?.type === "insufficient_quota";
        const response = { error: { message }, quota_error: quota_error };
        if (!response_generate_openai.headersSent) {
            response_generate_openai.send(response);
        } else if (!response_generate_openai.writableEnded) {
            response_generate_openai.write(response);
        }
    }

    makeRequest(config, response_generate_openai, request);
});

app.post("/tokenize_openai", jsonParser, function (request, response_tokenize_openai) {
    if (!request.body) return response_tokenize_openai.sendStatus(400);

    let num_tokens = 0;
    const model = getTokenizerModel(String(request.query.model || ""));

    if (model == "claude") {
        num_tokens = countClaudeTokens(claude_tokenizer, request.body);
        return response_tokenize_openai.send({ token_count: num_tokens });
    }

    const tokensPerName = model.includes("gpt-4") ? 1 : -1;
    const tokensPerMessage = model.includes("gpt-4") ? 3 : 4;
    const tokensPadding = 3;

    const tokenizer = getTiktokenTokenizer(model);

    for (const msg of request.body) {
        try {
            num_tokens += tokensPerMessage;
            for (const [key, value] of Object.entries(msg)) {
                num_tokens += tokenizer.encode(value).length;
                if (key == "name") {
                    num_tokens += tokensPerName;
                }
            }
        } catch {
            console.warn("Error tokenizing message:", msg);
        }
    }
    num_tokens += tokensPadding;

    // not needed for cached tokenizers
    //tokenizer.free();

    response_tokenize_openai.send({ token_count: num_tokens });
});

app.post("/save_preset", jsonParser, function (request, response) {
    const name = sanitize(request.body.name);
    if (!request.body.preset || !name) {
        return response.sendStatus(400);
    }

    const filename = `${name}.settings`;
    const directory = getPresetFolderByApiId(request.body.apiId);

    if (!directory) {
        return response.sendStatus(400);
    }

    const fullpath = path.join(directory, filename);
    fs.writeFileSync(fullpath, JSON.stringify(request.body.preset, null, 4), "utf-8");
    return response.send({ name });
});

app.post("/delete_preset", jsonParser, function (request, response) {
    const name = sanitize(request.body.name);
    if (!name) {
        return response.sendStatus(400);
    }

    const filename = `${name}.settings`;
    const directory = getPresetFolderByApiId(request.body.apiId);

    if (!directory) {
        return response.sendStatus(400);
    }

    const fullpath = path.join(directory, filename);

    if (fs.existsSync) {
        fs.unlinkSync(fullpath);
        return response.sendStatus(200);
    } else {
        return response.sendStatus(404);
    }
});

app.post("/savepreset_openai", jsonParser, function (request, response) {
    const name = sanitize(request.query.name);
    if (!request.body || !name) {
        return response.sendStatus(400);
    }

    const filename = `${name}.settings`;
    const fullpath = path.join(directories.openAI_Settings, filename);
    fs.writeFileSync(fullpath, JSON.stringify(request.body, null, 4), "utf-8");
    return response.send({ name });
});

function getPresetFolderByApiId(apiId) {
    switch (apiId) {
        case "textgenerationwebui":
            return directories.textGen_Settings;
        default:
            return null;
    }
}

function createTokenizationHandler(getTokenizerFn) {
    return async function (request, response) {
        if (!request.body) {
            return response.sendStatus(400);
        }

        const text = request.body.text || "";
        const tokenizer = getTokenizerFn();
        const { ids, count } = await countSentencepieceTokens(tokenizer, text);
        return response.send({ ids, count });
    };
}

app.post(
    "/tokenize_llama",
    jsonParser,
    createTokenizationHandler(() => spp_llama),
);
app.post(
    "/tokenize_nerdstash",
    jsonParser,
    createTokenizationHandler(() => spp_nerd),
);
app.post(
    "/tokenize_nerdstash_v2",
    jsonParser,
    createTokenizationHandler(() => spp_nerd_v2),
);
app.post("/tokenize_via_api", jsonParser, async function (request, response) {
    if (!request.body) {
        return response.sendStatus(400);
    }
    const text = request.body.text || "";

    try {
        const args = {
            body: JSON.stringify({ prompt: text }),
            headers: { "Content-Type": "application/json" },
        };

        const main_api = request.body.main_api;
        if (main_api == "textgenerationwebui" && request.body.use_mancer) {
            args.headers = Object.assign(args.headers, get_mancer_headers());
        }

        const data = await postAsync(api_server + "/v1/token-count", args);
        console.log(data);
        return response.send({ count: data["results"][0]["tokens"] });
    } catch (error) {
        console.log(error);
        return response.send({ error: true });
    }
});

// ** REST CLIENT ASYNC WRAPPERS **

async function postAsync(url, args) {
    const response = await fetch(url, { method: "POST", timeout: 0, ...args });

    if (response.ok) {
        const data = await response.json();
        return data;
    }

    throw response;
}

const tavernUrl = new URL(
    (cliArguments.ssl ? "https://" : "http://") + (listen ? "0.0.0.0" : "127.0.0.1") + (":" + server_port),
);

const autorunUrl = new URL((cliArguments.ssl ? "https://" : "http://") + "127.0.0.1" + (":" + server_port));

const setupTasks = async function () {
    backupSettings();
    migrateSecrets();
    ensurePublicDirectoriesExist();
    await ensureThumbnailCache();
    contentManager.checkForNewContent();

    [spp_llama, spp_nerd, spp_nerd_v2, claude_tokenizer] = await Promise.all([
        loadSentencepieceTokenizer("./src/sentencepiece/tokenizer.model"),
        loadSentencepieceTokenizer("./src/sentencepiece/nerdstash.model"),
        loadSentencepieceTokenizer("./src/sentencepiece/nerdstash_v2.model"),
        loadClaudeTokenizer("./src/claude.min.json"),
    ]);

    await statsHelpers.loadStatsFile(directories.chats, directories.characters);

    // Set up event listeners for a graceful shutdown
    process.on("SIGINT", statsHelpers.writeStatsToFileAndExit);
    process.on("SIGTERM", statsHelpers.writeStatsToFileAndExit);
    process.on("uncaughtException", (err) => {
        console.error("Uncaught exception:", err);
        statsHelpers.writeStatsToFileAndExit();
    });

    setInterval(statsHelpers.saveStatsToFile, 5 * 60 * 1000);

    console.log("Launching...");

    if (autorun) open(autorunUrl.toString());
    console.log("YukiTavern is listening on: " + tavernUrl);
};

if (listen && !config.whitelistMode && !config.basicAuthMode) {
    if (config.securityOverride)
        console.warn("Security has been overriden. If it's not a trusted network, change the settings.");
    else {
        console.error(
            "Your yukitavern is currently unsecurely open to the public. Enable whitelisting or basic authentication.",
        );
        process.exit(1);
    }
}
if (true === cliArguments.ssl)
    https
        .createServer(
            {
                cert: fs.readFileSync(cliArguments.certPath),
                key: fs.readFileSync(cliArguments.keyPath),
            },
            app,
        )
        .listen(tavernUrl.port || 443, tavernUrl.hostname, setupTasks);
else http.createServer(app).listen(tavernUrl.port || 80, tavernUrl.hostname, setupTasks);

function backupSettings() {
    const MAX_BACKUPS = 25;

    function generateTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const seconds = String(now.getSeconds()).padStart(2, "0");

        return `${year}${month}${day}-${hours}${minutes}${seconds}`;
    }

    try {
        if (!fs.existsSync(directories.backups)) {
            fs.mkdirSync(directories.backups);
        }

        const backupFile = path.join(directories.backups, `settings_${generateTimestamp()}.json`);
        fs.copyFileSync(SETTINGS_FILE, backupFile);

        let files = fs.readdirSync(directories.backups);
        if (files.length > MAX_BACKUPS) {
            files = files.map((f) => path.join(directories.backups, f));
            files.sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);

            fs.rmSync(files[0]);
        }
    } catch (err) {
        console.log("Could not backup settings file", err);
    }
}

function ensurePublicDirectoriesExist() {
    for (const dir of Object.values(directories)) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

const SECRETS_FILE = path.join(baseDir, "secrets.json");
const SETTINGS_FILE = path.join(baseDir, "public", "settings.json");
const SECRET_KEYS = {
    MANCER: "api_key_mancer",
    OPENAI: "api_key_openai",
    CLAUDE: "api_key_claude",
    DEEPL: "deepl",
    OPENROUTER: "api_key_openrouter",
};

function migrateSecrets() {
    if (!fs.existsSync(SETTINGS_FILE)) {
        console.log("Settings file does not exist");
        return;
    }

    try {
        let modified = false;
        const fileContents = fs.readFileSync(SETTINGS_FILE);
        const settings = JSON.parse(fileContents.toString());
        const oaiKey = settings?.api_key_openai;

        if (typeof oaiKey === "string") {
            console.log("Migrating OpenAI key...");
            writeSecret(SECRET_KEYS.OPENAI, oaiKey);
            delete settings.api_key_openai;
            modified = true;
        }

        if (modified) {
            console.log("Writing updated settings.json...");
            const settingsContent = JSON.stringify(settings);
            fs.writeFileSync(SETTINGS_FILE, settingsContent, "utf-8");
        }
    } catch (error) {
        console.error("Could not migrate secrets file. Proceed with caution.");
    }
}

app.post("/writesecret", jsonParser, (request, response) => {
    const key = request.body.key;
    const value = request.body.value;

    writeSecret(key, value);
    return response.send("ok");
});

app.post("/readsecretstate", jsonParser, (_, response) => {
    if (!fs.existsSync(SECRETS_FILE)) {
        return response.send({});
    }

    try {
        const fileContents = fs.readFileSync(SECRETS_FILE);
        const secrets = JSON.parse(fileContents.toString());
        const state = {};

        for (const key of Object.values(SECRET_KEYS)) {
            state[key] = !!secrets[key]; // convert to boolean
        }

        return response.send(state);
    } catch (error) {
        console.error(error);
        return response.send({});
    }
});

app.post("/viewsecrets", jsonParser, async (_, response) => {
    if (!allowKeysExposure) {
        console.error(
            "secrets.json could not be viewed unless the value of allowKeysExposure in config.json is set to true",
        );
        return response.sendStatus(403);
    }

    if (!fs.existsSync(SECRETS_FILE)) {
        console.error("secrets.json does not exist");
        return response.sendStatus(404);
    }

    try {
        const fileContents = fs.readFileSync(SECRETS_FILE);
        const secrets = JSON.parse(fileContents.toString());
        return response.send(secrets);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

app.post("/delete_sprite", jsonParser, async (request, response) => {
    const label = request.body.label;
    const name = request.body.name;

    if (!label || !name) {
        return response.sendStatus(400);
    }

    try {
        const spritesPath = path.join(directories.characters, name);

        // No sprites folder exists, or not a directory
        if (!fs.existsSync(spritesPath) || !fs.statSync(spritesPath).isDirectory()) {
            return response.sendStatus(404);
        }

        const files = fs.readdirSync(spritesPath);

        // Remove existing sprite with the same label
        for (const file of files) {
            if (path.parse(file).name === label) {
                fs.rmSync(path.join(spritesPath, file));
            }
        }

        return response.sendStatus(200);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

app.post("/upload_sprite_pack", urlencodedParser, async (request, response) => {
    const file = request.file;
    const name = request.body.name;

    if (!file || !name) {
        return response.sendStatus(400);
    }

    try {
        const spritesPath = path.join(directories.characters, name);

        // Create sprites folder if it doesn't exist
        if (!fs.existsSync(spritesPath)) {
            fs.mkdirSync(spritesPath);
        }

        // Path to sprites is not a directory. This should never happen.
        if (!fs.statSync(spritesPath).isDirectory()) {
            return response.sendStatus(404);
        }

        const spritePackPath = path.join("./uploads/", file.filename);
        const sprites = await getImageBuffers(spritePackPath);
        const files = fs.readdirSync(spritesPath);

        for (const [filename, buffer] of sprites) {
            // Remove existing sprite with the same label
            const existingFile = files.find((file) => path.parse(file).name === path.parse(filename).name);

            if (existingFile) {
                fs.rmSync(path.join(spritesPath, existingFile));
            }

            // Write sprite buffer to disk
            const pathToSprite = path.join(spritesPath, filename);
            fs.writeFileSync(pathToSprite, buffer);
        }

        // Remove uploaded ZIP file
        fs.rmSync(spritePackPath);
        return response.send({ count: (sprites as Buffer[]).length });
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

app.post("/upload_sprite", urlencodedParser, async (request, response) => {
    const file = request.file;
    const label = request.body.label;
    const name = request.body.name;

    if (!file || !label || !name) {
        return response.sendStatus(400);
    }

    try {
        const spritesPath = path.join(directories.characters, name);

        // Create sprites folder if it doesn't exist
        if (!fs.existsSync(spritesPath)) {
            fs.mkdirSync(spritesPath);
        }

        // Path to sprites is not a directory. This should never happen.
        if (!fs.statSync(spritesPath).isDirectory()) {
            return response.sendStatus(404);
        }

        const files = fs.readdirSync(spritesPath);

        // Remove existing sprite with the same label
        for (const file of files) {
            if (path.parse(file).name === label) {
                fs.rmSync(path.join(spritesPath, file));
            }
        }

        const filename = label + path.parse(file.originalname).ext;
        const spritePath = path.join(directories.uploads, file.filename);
        const pathToFile = path.join(spritesPath, filename);
        // Copy uploaded file to sprites folder
        fs.cpSync(spritePath, pathToFile);
        // Remove uploaded file
        fs.rmSync(spritePath);
        return response.sendStatus(200);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

app.post("/import_custom", jsonParser, async (request, response) => {
    if (!request.body.url) {
        return response.sendStatus(400);
    }

    try {
        const url = request.body.url;
        let result;

        const chubParsed = parseChubUrl(url);

        if (chubParsed?.type === "character") {
            console.log("Downloading chub character:", chubParsed.id);
            result = await downloadChubCharacter(chubParsed.id);
        } else if (chubParsed?.type === "lorebook") {
            console.log("Downloading chub lorebook:", chubParsed.id);
            result = await downloadChubLorebook(chubParsed.id);
        } else {
            return response.sendStatus(404);
        }

        response.set("Content-Type", result.fileType);
        response.set("Content-Disposition", `attachment; filename="${result.fileName}"`);
        response.set("X-Custom-Content-Type", chubParsed?.type);
        return response.send(result.buffer);
    } catch (error) {
        console.log("Importing custom content failed", error);
        return response.sendStatus(500);
    }
});

async function downloadChubLorebook(id) {
    const result = await fetch("https://api.chub.ai/api/lorebooks/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            fullPath: id,
            format: "yukitavern",
        }),
    });

    if (!result.ok) {
        console.log(await result.text());
        throw new Error("Failed to download lorebook");
    }

    const name = id.split("/").pop();
    const buffer = await result.buffer();
    const fileName = `${sanitize(name)}.json`;
    const fileType = result.headers.get("content-type");

    return { buffer, fileName, fileType };
}

async function downloadChubCharacter(id) {
    const result = await fetch("https://api.chub.ai/api/characters/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            format: "tavern",
            fullPath: id,
        }),
    });

    if (!result.ok) {
        throw new Error("Failed to download character");
    }

    const buffer = await result.buffer();
    const fileName = result.headers.get("content-disposition")?.split("filename=")[1] || `${sanitize(id)}.png`;
    const fileType = result.headers.get("content-type");

    return { buffer, fileName, fileType };
}

function parseChubUrl(str) {
    const splitStr = str.split("/");
    const length = splitStr.length;

    if (length < 2) {
        return null;
    }

    let domainIndex = -1;

    splitStr.forEach((part, index) => {
        if (part === "www.chub.ai" || part === "chub.ai") {
            domainIndex = index;
        }
    });

    const lastTwo = domainIndex !== -1 ? splitStr.slice(domainIndex + 1) : splitStr;

    const firstPart = lastTwo[0].toLowerCase();

    if (firstPart === "characters" || firstPart === "lorebooks") {
        const type = firstPart === "characters" ? "character" : "lorebook";
        const id = type === "character" ? lastTwo.slice(1).join("/") : lastTwo.join("/");
        return {
            id: id,
            type: type,
        };
    } else if (length === 2) {
        return {
            id: lastTwo.join("/"),
            type: "character",
        };
    }

    return null;
}

function writeSecret(key, value) {
    if (!fs.existsSync(SECRETS_FILE)) {
        const emptyFile = JSON.stringify({});
        fs.writeFileSync(SECRETS_FILE, emptyFile, "utf-8");
    }

    const fileContents = fs.readFileSync(SECRETS_FILE);
    const secrets = JSON.parse(fileContents.toString());
    secrets[key] = value;
    fs.writeFileSync(SECRETS_FILE, JSON.stringify(secrets), "utf-8");
}

function readSecret(key) {
    if (!fs.existsSync(SECRETS_FILE)) {
        return undefined;
    }

    const fileContents = fs.readFileSync(SECRETS_FILE);
    const secrets = JSON.parse(fileContents.toString());
    return secrets[key];
}

async function readAllChunks(readableStream) {
    return new Promise((resolve, reject) => {
        // Consume the readable stream
        const chunks = [];
        readableStream.on("data", (chunk) => {
            chunks.push(chunk);
        });

        readableStream.on("end", () => {
            console.log("Finished reading the stream.");
            resolve(chunks);
        });

        readableStream.on("error", (error) => {
            console.error("Error while reading the stream:", error);
            reject();
        });
    });
}

async function getImageBuffers(zipFilePath: fs.PathLike): Promise<[string, Buffer][]> {
    return new Promise((resolve, reject) => {
        // Check if the zip file exists
        if (!fs.existsSync(zipFilePath)) {
            reject(new Error("File not found"));
            return;
        }

        const imageBuffers = [];

        yauzl.open(zipFilePath, { lazyEntries: true }, (err, zipfile) => {
            if (err) {
                reject(err);
            } else {
                zipfile.readEntry();
                zipfile.on("entry", (entry) => {
                    const mimeType = mime.lookup(entry.fileName);
                    if (mimeType && mimeType.startsWith("image/") && !entry.fileName.startsWith("__MACOSX")) {
                        console.log(`Extracting ${entry.fileName}`);
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err) {
                                reject(err);
                            } else {
                                const chunks = [];
                                readStream.on("data", (chunk) => {
                                    chunks.push(chunk);
                                });

                                readStream.on("end", () => {
                                    imageBuffers.push([path.parse(entry.fileName).base, Buffer.concat(chunks)]);
                                    zipfile.readEntry(); // Continue to the next entry
                                });
                            }
                        });
                    } else {
                        zipfile.readEntry(); // Continue to the next entry
                    }
                });

                zipfile.on("end", () => {
                    resolve(imageBuffers);
                });

                zipfile.on("error", (err) => {
                    reject(err);
                });
            }
        });
    });
}
