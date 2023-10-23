import express from "express";
import fs from "fs";
import path from "path";
import { directories } from "../utils/directories.js";
import { jsonParser } from "../utils/common.js";
import sanitize from "sanitize-filename";
import { humanizedISO8601DateTime } from "../utils/common.js";
import { urlencodedParser } from "../utils/common.js";
import readline from "readline";
import json5 from "json5";
import { tryParse } from "../utils/common.js";

const app = express();
export default app;

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
                            chat.push(userMessage as any);
                        }
                        if (arr[1]) {
                            const charMessage = {
                                name: ch_name,
                                is_user: false,
                                is_name: true,
                                send_date: humanizedISO8601DateTime(),
                                mes: arr[1],
                            };
                            chat.push(charMessage as any);
                        }
                    }

                    fs.writeFileSync(
                        `${directories.chats + avatar_url}/${ch_name} - ${humanizedISO8601DateTime()} imported.jsonl`,
                        chat.map((message) => JSON.stringify(message, null, 2)).join("\n"),
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
