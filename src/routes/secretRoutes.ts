import express from "express";
import fs from "fs";
import path from "path";
import { baseDir } from "../utils/directories.js";
import config from "../utils/config.js";

import { jsonParser } from "../utils/common.js";
import { SECRETS_FILE, SECRET_KEYS } from "../utils/constants.js";

const app = express();
export default app;

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
    if (!config.allowKeysExposure) {
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

export function writeSecret(key, value) {
    if (!fs.existsSync(SECRETS_FILE)) {
        const emptyFile = JSON.stringify({});
        fs.writeFileSync(SECRETS_FILE, emptyFile, "utf-8");
    }

    const fileContents = fs.readFileSync(SECRETS_FILE);
    const secrets = JSON.parse(fileContents.toString());
    secrets[key] = value;
    fs.writeFileSync(SECRETS_FILE, JSON.stringify(secrets), "utf-8");
}
