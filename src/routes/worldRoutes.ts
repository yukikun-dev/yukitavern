import express from "express";
import fs from "fs";
import path from "path";
import { baseDir, directories } from "../utils/directories.js";
import { jsonParser } from "../utils/common.js";
import json5 from "json5";
import sanitize from "sanitize-filename";
import { urlencodedParser } from "../utils/common.js";
import { readWorldInfoFile } from "../controllers/worlds.js";

const app = express();
export default app;

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
