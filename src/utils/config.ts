// read from ../config.json
// {
//     "port": 56565,
//     "whitelist": ["127.0.0.1"],
//     "whitelistMode": false,
//     "basicAuthMode": false,
//     "basicAuthUser": {
//         "username": "user",
//         "password": "password"
//     },
//     "disableThumbnails": false,
//     "autorun": false,
//     "enableExtensions": true,
//     "listen": true,
//     "allowKeysExposure": false,
//     "securityOverride": true,
//     "disableCsrf": true,
//     "ssl": false,
//     "certPath": "certs/cert.pem",
//     "keyPath": "certs/privkey.pem"
// }

import path from "path";
import fs from "fs";

import { baseDir } from "./directories.js";
const configPath = path.join(baseDir, "config.json");

if (!fs.existsSync(configPath)) {
    const defaultFilePath = path.join("default", path.parse(configPath).base);
    fs.copyFileSync(defaultFilePath, configPath);
    console.log(`Created default file: ${configPath}`);
}

const config = JSON.parse(fs.readFileSync(configPath).toString());

export default config;
