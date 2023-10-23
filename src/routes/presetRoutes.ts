import express from "express";
import fs from "fs";
import path from "path";
import { directories } from "../utils/directories.js";
import { jsonParser } from "../utils/common.js";
import sanitize from "sanitize-filename";

const app = express();
export default app;
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

function getPresetFolderByApiId(apiId) {
    switch (apiId) {
        case "textgenerationwebui":
            return directories.textGen_Settings;
        default:
            return null;
    }
}

app.post("/savepreset_openai", jsonParser, function (request, response) {
    const name = sanitize(request.query.name.toString());
    if (!request.body || !name) {
        return response.sendStatus(400);
    }

    const filename = `${name}.settings`;
    const fullpath = path.join(directories.openAI_Settings, filename);
    fs.writeFileSync(fullpath, JSON.stringify(request.body, null, 4), "utf-8");
    return response.send({ name });
});
