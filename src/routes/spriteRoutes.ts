import express from "express";
import fs from "fs";
import path from "path";
import { getImageBuffers } from "../utils/imageUtils.js";
import { jsonParser, urlencodedParser } from "../utils/common.js";
import mime from "mime-types";
import { directories } from "../utils/directories.js";

const app = express();
export default app;

app.post("/delete_sprite", jsonParser, async (request, response) => {
    const label = request.body.label;
    const name = request.body.name;

    if (!label || !name) {
        return response.sendStatus(400);
    }

    try {
        const spritesPath = path.join(directories.characters, name);

        // No sprites folder exists, or not a directory
        if (!fs.existsSync(spritesPath) || !fs.statSync(spritesPath).isDirectory()) {
            return response.sendStatus(404);
        }

        const files = fs.readdirSync(spritesPath);

        // Remove existing sprite with the same label
        for (const file of files) {
            if (path.parse(file).name === label) {
                fs.rmSync(path.join(spritesPath, file));
            }
        }

        return response.sendStatus(200);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

app.post("/upload_sprite_pack", urlencodedParser, async (request, response) => {
    const file = request.file;
    const name = request.body.name;

    if (!file || !name) {
        return response.sendStatus(400);
    }

    try {
        const spritesPath = path.join(directories.characters, name);

        // Create sprites folder if it doesn't exist
        if (!fs.existsSync(spritesPath)) {
            fs.mkdirSync(spritesPath);
        }

        // Path to sprites is not a directory. This should never happen.
        if (!fs.statSync(spritesPath).isDirectory()) {
            return response.sendStatus(404);
        }

        const spritePackPath = path.join("./uploads/", file.filename);
        const sprites = await getImageBuffers(spritePackPath);
        const files = fs.readdirSync(spritesPath);

        for (const [filename, buffer] of sprites) {
            // Remove existing sprite with the same label
            const existingFile = files.find((file) => path.parse(file).name === path.parse(filename).name);

            if (existingFile) {
                fs.rmSync(path.join(spritesPath, existingFile));
            }

            // Write sprite buffer to disk
            const pathToSprite = path.join(spritesPath, filename);
            fs.writeFileSync(pathToSprite, buffer);
        }

        // Remove uploaded ZIP file
        fs.rmSync(spritePackPath);
        return response.send({ count: (sprites as unknown as Buffer[]).length });
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

app.post("/upload_sprite", urlencodedParser, async (request, response) => {
    const file = request.file;
    const label = request.body.label;
    const name = request.body.name;

    if (!file || !label || !name) {
        return response.sendStatus(400);
    }

    try {
        const spritesPath = path.join(directories.characters, name);

        // Create sprites folder if it doesn't exist
        if (!fs.existsSync(spritesPath)) {
            fs.mkdirSync(spritesPath);
        }

        // Path to sprites is not a directory. This should never happen.
        if (!fs.statSync(spritesPath).isDirectory()) {
            return response.sendStatus(404);
        }

        const files = fs.readdirSync(spritesPath);

        // Remove existing sprite with the same label
        for (const file of files) {
            if (path.parse(file).name === label) {
                fs.rmSync(path.join(spritesPath, file));
            }
        }

        const filename = label + path.parse(file.originalname).ext;
        const spritePath = path.join(directories.uploads, file.filename);
        const pathToFile = path.join(spritesPath, filename);
        // Copy uploaded file to sprites folder
        fs.cpSync(spritePath, pathToFile);
        // Remove uploaded file
        fs.rmSync(spritePath);
        return response.sendStatus(200);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

app.get("/get_sprites", jsonParser, function (request, response) {
    const name = request.query.name.toString();
    const spritesPath = path.join(directories.characters, name);
    let sprites = [];

    try {
        if (fs.existsSync(spritesPath) && fs.statSync(spritesPath).isDirectory()) {
            sprites = fs
                .readdirSync(spritesPath)
                .filter((file) => {
                    const mimeType = mime.lookup(file);
                    return mimeType && mimeType.startsWith("image/");
                })
                .map((file) => {
                    const pathToSprite = path.join(spritesPath, file);
                    return {
                        label: path.parse(pathToSprite).name.toLowerCase(),
                        path: `/characters/${name}/${file}`,
                    };
                });
        }
    } catch (err) {
        console.log(err);
    } finally {
        return response.send(sprites);
    }
});
