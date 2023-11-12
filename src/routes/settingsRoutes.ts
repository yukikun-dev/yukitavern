import express from "express";
import fs from "fs";
import path from "path";
import { baseDir, directories } from "../utils/directories.js";
import { jsonParser } from "../utils/common.js";
import config from "../utils/config.js";
import sanitize from "sanitize-filename";

const app = express();
export default app;
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
        enable_extensions: config.enableExtensions,
    });
});

function sortByModifiedDate(directory: string) {
    return (a, b) =>
        new Date(fs.statSync(`${directory}/${b}`).mtime).getTime() -
        new Date(fs.statSync(`${directory}/${a}`).mtime).getTime();
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
            JSON.parse(file);
            fileContents.push(file);
            fileNames.push(removeFileExtension ? item.replace(/\.[^/.]+$/, "") : item);
        } catch {
            // skip
            console.log(`${item} is not a valid JSON`);
        }
    });

    return { fileContents, fileNames };
}

function sortByName() {
    return (a, b) => a.localeCompare(b);
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
            parsedFiles.push(fileExtension == ".json" ? JSON.parse(file) : file);
        } catch {
            // skip
        }
    });

    return parsedFiles;
}

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
