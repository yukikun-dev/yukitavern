import express from "express";
import fs from "fs";
import path from "path";
import { directories } from "../utils/directories.js";
import { jsonParser } from "../utils/common.js";
import json5 from "json5";
import sanitize from "sanitize-filename";
import { humanizedISO8601DateTime } from "../utils/common.js";
import { urlencodedParser } from "../utils/common.js";

const app = express();
export default app;

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
        const jsonData = lines.map((line) => json5.parse(line));
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
        const group = json5.parse(fs.readFileSync(pathToGroup).toString());

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
