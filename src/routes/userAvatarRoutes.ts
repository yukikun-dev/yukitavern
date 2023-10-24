import express from "express";
import fs from "fs";
import jimp from "jimp";
import path from "path";
import sanitize from "sanitize-filename";
import { jsonParser, tryParse, urlencodedParser } from "../utils/common.js";
import { baseDir, directories } from "../utils/directories.js";
import { getImages } from "../utils/imageUtils.js";
import { AVATAR_HEIGHT, AVATAR_WIDTH } from "../utils/constants.js";

const app = express();
export default app;

app.post("/getuseravatars", jsonParser, function (_, response) {
    var images = getImages(path.join(baseDir, "public", "User Avatars"));
    response.send(JSON.stringify(images));
});

app.post("/deleteuseravatar", jsonParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    if (request.body.avatar !== sanitize(request.body.avatar)) {
        console.error("Malicious avatar name prevented");
        return response.sendStatus(403);
    }

    const fileName = path.join(directories.avatars, sanitize(request.body.avatar));

    if (fs.existsSync(fileName)) {
        fs.rmSync(fileName);
        return response.send({ result: "ok" });
    }

    return response.sendStatus(404);
});

app.post("/uploaduseravatar", urlencodedParser, async (request, response) => {
    if (!request.file) return response.sendStatus(400);

    try {
        const pathToUpload = path.join("./uploads/" + request.file.filename);
        const crop = tryParse(request.query.crop);
        let rawImg = await jimp.read(pathToUpload);

        if (typeof crop == "object" && [crop.x, crop.y, crop.width, crop.height].every((x) => typeof x === "number")) {
            rawImg = rawImg.crop(crop.x, crop.y, crop.width, crop.height);
        }

        const image = await rawImg.cover(AVATAR_WIDTH, AVATAR_HEIGHT).getBufferAsync(jimp.MIME_PNG);

        const filename = request.body.overwrite_name || `${Date.now()}.png`;
        const pathToNewFile = path.join(directories.avatars, filename);
        fs.writeFileSync(pathToNewFile, image);
        fs.rmSync(pathToUpload);
        return response.send({ path: filename });
    } catch (err) {
        return response.status(400).send("Is not a valid image");
    }
});
