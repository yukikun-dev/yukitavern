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
import json5 from "json5";

import { baseDir } from "./directories.js";
const configPath = path.join(baseDir, "config.json5");

const config = json5.parse(fs.readFileSync(configPath).toString());

export default config;
