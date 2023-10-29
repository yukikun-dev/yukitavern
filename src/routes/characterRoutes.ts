import PNGtext from "png-chunk-text";
import encode from "png-chunks-encode";
import extract from "png-chunks-extract";
import multer from "multer";
import express from "express";
import fs from "fs";
import path from "path";
import { directories } from "../utils/directories.js";
import { jsonParser } from "../utils/common.js";
import _ from "lodash";
import { humanizedISO8601DateTime, tryParse } from "../utils/common.js";
import sanitize from "sanitize-filename";
import { getPngName, invalidateThumbnail } from "../utils/imageUtils.js";
import { readWorldInfoFile } from "../controllers/worlds.js";
import { urlencodedParser } from "../utils/common.js";
import { AVATAR_HEIGHT, AVATAR_WIDTH } from "../utils/constants.js";
import jimp from "jimp";
import { baseDir } from "../utils/directories.js";
import json5 from "json5";
import readline from "readline";
import { parse } from "../character-card-parser.js";

let characters = {};

const app = express();
app.use(multer({ dest: "uploads", limits: { fieldSize: 10 * 1024 * 1024 } }).single("avatar"));
export default app;

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

app.post("/createcharacter", urlencodedParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    request.body.ch_name = sanitize(request.body.ch_name);

    const char = JSON.stringify(charaFormatData(request.body));
    const internalName = getPngName(request.body.ch_name);
    const avatarName = `${internalName}.png`;
    const defaultAvatar = path.join(baseDir, "public", "img", "ai4.png");
    const chatsPath = path.join(directories.chats, internalName);

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

function getCharaCardV2(jsonObject) {
    if (jsonObject.spec === undefined) {
        jsonObject = convertToV2(jsonObject);
    } else {
        jsonObject = readFromV2(jsonObject);
    }
    return jsonObject;
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

    const avatarPath = path.join(directories.characters, request.body.avatar_url);
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
        const tEXtChunks = chunks.filter((chunk: any) => chunk.create_date === "tEXt" || chunk.name === "tEXt");

        // Remove all existing tEXt chunks
        for (let tEXtChunk of tEXtChunks) {
            chunks.splice(chunks.indexOf(tEXtChunk), 1);
        }
        const base64EncodedData = Buffer.from(data, "utf8").toString("base64");
        chunks.splice(-1, 0, PNGtext.encode("chara", base64EncodedData));

        fs.writeFileSync(path.join(directories.characters, target_img + ".png"), Buffer.from(encode(chunks)));
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

function unsetFavFlag(char) {
    _.set(char, "fav", false);
    _.set(char, "data.extensions.fav", false);
}

app.post("/importcharacter", urlencodedParser, async function (request, response) {
    if (!request.body) return response.sendStatus(400);

    let png_name = "";
    let filedata = request.file;
    let uploadPath = path.join(directories.uploads, filedata.filename);
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
                    charaWrite(defaultAvatarPath, char, png_name, response, png_name);
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
                    const charObj = {
                        name: char.name,
                        description: char.description,
                        creatorcomment: char.creatorcomment,
                        personality: char.personality,
                        first_mes: char.first_mes,
                        avatar: char.avatar,
                        chat: char.chat,
                        mes_example: char.mes_example,
                        scenario: char.scenario,
                        create_date: char.create_date,
                        talkativeness: char.talkativeness,
                        creator: char.creator,
                        tags: char.tags,
                    };
                    charaWrite(defaultAvatarPath, JSON.stringify(charObj), png_name, response, png_name);
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
                    const charObj = {
                        name: char.name,
                        description: char.description,
                        creatorcomment: char.creatorcomment,
                        personality: char.personality,
                        first_mes: char.first_mes,
                        avatar: char.avatar,
                        chat: char.chat,
                        mes_example: char.mes_example,
                        scenario: char.scenario,
                        create_date: char.create_date,
                        talkativeness: char.talkativeness,
                        creator: char.creator,
                        tags: char.tags,
                    };
                    charaWrite(defaultAvatarPath, JSON.stringify(charObj), png_name, response, png_name);
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
                    charaWrite(uploadPath, char, png_name, response, png_name);
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
                    const charObj = {
                        name: char.name,
                        description: char.description,
                        creatorcomment: char.creatorcomment,
                        personality: char.personality,
                        first_mes: char.first_mes,
                        avatar: char.avatar,
                        chat: char.chat,
                        mes_example: char.mes_example,
                        scenario: char.scenario,
                        create_date: char.create_date,
                        talkativeness: char.talkativeness,
                        creator: char.creator,
                        tags: char.tags,
                    };
                    await charaWrite(uploadPath, JSON.stringify(charObj), png_name, response, png_name);
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
            return response.sendFile(filename);
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

app.post("/getallchatsofcharacter", jsonParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    var char_dir = request.body.avatar_url.replace(".png", "");
    fs.readdir(path.join(directories.chats, char_dir), (err, files) => {
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
                const fileStream = fs.createReadStream(path.join(directories.chats, char_dir, file));

                const fullPathAndFile = path.join(directories.chats, char_dir, file);
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
    const buffer = await (result as any).buffer();
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

    const buffer = await (result as any).buffer();
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
