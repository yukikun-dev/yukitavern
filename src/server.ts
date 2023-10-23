#!/usr/bin/env node
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import crypto from "crypto";
import { doubleCsrf } from "csrf-csrf";
import express from "express";
import fs from "fs";
import http from "http";
import https from "https";
import ipMatching from "ip-matching";
import ipaddr, { IPv6 } from "ipaddr.js";
import _ from "lodash";
import { Client } from "node-rest-client";
import open from "open";
import path from "path";
import process from "process";
import responseTime from "response-time";
import contentManager from "./content-manager.js";
import basicAuthMiddleware from "./middleware/basicAuthMiddleware.js";
import { generateThumbnail } from "./routes/index.js";
import { writeSecret } from "./routes/secretRoutes.js";
import * as statsHelpers from "./statsHelpers.js";
import { SECRET_KEYS } from "./utils/constants.js";
import { baseDir, directories } from "./utils/directories.js";

const SETTINGS_FILE = path.join(baseDir, "public", "settings.json");

createDefaultFiles();

function createDefaultFiles() {
    const files = {
        settings: path.join(baseDir, "public", "settings.json"),
        bg_load: path.join(baseDir, "public", "css", "bg_load.css"),
        config: path.join(baseDir, "config.json5"),
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

const app = express();

import backgroundRoutes from "./routes/backgroundRoutes.js";
import characterRoutes from "./routes/characterRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import extensionsRoutes from "./routes/extensionsRoutes.js";
import generateRoutes from "./routes/generateRoutes.js";
import groupChatRoutes from "./routes/groupChatRoutes.js";
import index from "./routes/index.js";
import openAiRoutes from "./routes/openAiRoutes.js";
import presetRoutes from "./routes/presetRoutes.js";
import secretRoutes from "./routes/secretRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import spriteRoutes from "./routes/spriteRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";
import tokenizeRoutes from "./routes/tokenizeRoutes.js";
import userAvatarRoutes from "./routes/userAvatarRoutes.js";
import worldRoutes from "./routes/worldRoutes.js";

app.use("/", index);
app.use("/", spriteRoutes);
app.use("/", secretRoutes);
app.use("/", chatRoutes);
app.use("/", settingsRoutes);
app.use("/", backgroundRoutes);
app.use("/", characterRoutes);
app.use("/", groupChatRoutes);
app.use("/", generateRoutes);
app.use("/", worldRoutes);
app.use("/", userAvatarRoutes);
app.use("/", tokenizeRoutes);
app.use("/", openAiRoutes);
app.use("/", statsRoutes);
app.use("/", presetRoutes);
app.use("/", extensionsRoutes);

app.use(compression());
app.use(responseTime());

import config from "./utils/config.js";

const server_port = process.env.SILLY_TAVERN_PORT || config.port;

const whitelistMode = config.whitelistMode;
const autorun = config.autorun && !config.ssl;
const enableExtensions = config.enableExtensions;
const listen = config.listen;

const client = new Client();

client.on("error", (err) => {
    console.error("An error occurred:", err);
});

// CSRF Protection //
if (config.disableCsrf === false) {
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
            token: generateToken(res, req),
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
    if (ip.kind() === "ipv6" && (ip as IPv6).isIPv4MappedAddress()) {
        const ipv4 = (ip as IPv6).toIPv4Address().toString();
        clientIp = ipv4;
    } else {
        clientIp = ip.toString();
    }

    if (whitelistMode === true && !config.whitelist.some((x) => ipMatching.matches(clientIp, ipMatching.getMatch(x)))) {
        console.log(
            "Forbidden: Connection attempt from " +
                clientIp +
                ". If you are attempting to connect, please add your IP address in whitelist or disable whitelist mode in config.json5 in root of yukitavern folder.\n",
        );
        return res
            .status(403)
            .send(
                "<b>Forbidden</b>: Connection attempt from <b>" +
                    clientIp +
                    "</b>. If you are attempting to connect, please add your IP address in whitelist or disable whitelist mode in config.json5 in root of yukitavern folder.",
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

//***************** Main functions

/**
 * Discover the extension folders
 * If the folder is called third-party, search for subfolders instead
 */

/* OpenAI */

const tavernUrl = new URL(
    (config.ssl ? "https://" : "http://") + (listen ? "0.0.0.0" : "127.0.0.1") + (":" + server_port),
);

const autorunUrl = new URL((config.ssl ? "https://" : "http://") + "127.0.0.1" + (":" + server_port));

const setupTasks = async function () {
    backupSettings();
    migrateSecrets();
    ensurePublicDirectoriesExist();
    await ensureThumbnailCache();
    contentManager.checkForNewContent();

    await statsHelpers.loadStatsFile(directories.chats, directories.characters);

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
if (true === config.ssl)
    https
        .createServer(
            {
                cert: fs.readFileSync(config.certPath),
                key: fs.readFileSync(config.keyPath),
            },
            app,
        )
        .listen(parseInt(tavernUrl.port) || 443, tavernUrl.hostname, setupTasks);
else http.createServer(app).listen(parseInt(tavernUrl.port) || 80, tavernUrl.hostname, setupTasks);

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
