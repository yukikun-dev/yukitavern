import DeviceDetector from "device-detector-js";
import express from "express";
import path from "path";
import sanitize from "sanitize-filename";
import config from "../utils/config.js";
import { baseDir, directories } from "../utils/directories.js";
import fs from "fs";
import mime from "mime-types";
import jimp from "jimp";
import { getThumbnailFolder } from "../utils/imageUtils.js";

const app = express();
export default app;

app.get("/", function (_, response) {
    response.sendFile(path.join(baseDir, "/public/index.html"));
});

app.get("/notes/*", function (request, response) {
    response.sendFile(path.join(baseDir, "/public" + request.url + ".html"));
});
app.get("/deviceinfo", function (request, response) {
    const userAgent = request.header("user-agent");
    const deviceDetector = new DeviceDetector();
    const deviceInfo = deviceDetector.parse(userAgent);
    return response.send(deviceInfo);
});

app.get("/thumbnail", express.json({ limit: "100mb" }), async function (request, response) {
    const type = request.query.type;
    const file = sanitize(request.query.file.toString());

    if (!type || !file) {
        return response.sendStatus(400);
    }

    if (!(type == "bg" || type == "avatar")) {
        return response.sendStatus(400);
    }

    if (sanitize(file) !== file) {
        console.error("Malicious filename prevented");
        return response.sendStatus(403);
    }

    if (config.disableThumbnails == true) {
        const pathToOriginalFile = path.join(getOriginalFolder(type), file);
        return response.sendFile(pathToOriginalFile);
    }

    const pathToCachedFile = await generateThumbnail(type, file);

    if (!pathToCachedFile) {
        return response.sendStatus(404);
    }

    return response.sendFile(pathToCachedFile);
});

function getOriginalFolder(type) {
    let originalFolder;

    switch (type) {
        case "bg":
            originalFolder = directories.backgrounds;
            break;
        case "avatar":
            originalFolder = directories.characters;
            break;
    }

    return originalFolder;
}

export async function generateThumbnail(type, file) {
    const pathToCachedFile = path.join(getThumbnailFolder(type), file);
    const pathToOriginalFile = path.join(getOriginalFolder(type), file);

    const cachedFileExists = fs.existsSync(pathToCachedFile);
    const originalFileExists = fs.existsSync(pathToOriginalFile);

    // to handle cases when original image was updated after thumb creation
    let shouldRegenerate = false;

    if (cachedFileExists && originalFileExists) {
        const originalStat = fs.statSync(pathToOriginalFile);
        const cachedStat = fs.statSync(pathToCachedFile);

        if (originalStat.mtimeMs > cachedStat.ctimeMs) {
            //console.log('Original file changed. Regenerating thumbnail...');
            shouldRegenerate = true;
        }
    }

    if (cachedFileExists && !shouldRegenerate) {
        return pathToCachedFile;
    }

    if (!originalFileExists) {
        return null;
    }

    const imageSizes = { bg: [160, 90], avatar: [96, 144] };
    const mySize = imageSizes[type];

    try {
        let buffer;

        try {
            const image = await jimp.read(pathToOriginalFile);
            buffer = await image.cover(mySize[0], mySize[1]).quality(95).getBufferAsync(mime.lookup("jpg").toString());
        } catch (inner) {
            console.warn(`Thumbnailer can not process the image: ${pathToOriginalFile}. Using original size`);
            buffer = fs.readFileSync(pathToOriginalFile);
        }

        fs.writeFileSync(pathToCachedFile, buffer);
    } catch (outer) {
        return null;
    }

    return pathToCachedFile;
}
