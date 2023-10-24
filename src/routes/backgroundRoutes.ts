import express from "express";
import fs from "fs";
import path from "path";
import { directories } from "../utils/directories.js";
import { jsonParser } from "../utils/common.js";
import sanitize from "sanitize-filename";
import { invalidateThumbnail } from "../utils/imageUtils.js";
import { baseDir } from "../utils/directories.js";
import { getImages } from "../utils/imageUtils.js";
import { urlencodedParser } from "../utils/common.js";

const app = express();
export default app;

app.post("/renamebackground", jsonParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    const oldFileName = path.join(directories.backgrounds, sanitize(request.body.old_bg));
    const newFileName = path.join(directories.backgrounds, sanitize(request.body.new_bg));

    if (!fs.existsSync(oldFileName)) {
        console.log("BG file not found");
        return response.sendStatus(400);
    }

    if (fs.existsSync(newFileName)) {
        console.log("New BG file already exists");
        return response.sendStatus(400);
    }

    fs.renameSync(oldFileName, newFileName);
    invalidateThumbnail("bg", request.body.old_bg);
    return response.send("ok");
});

app.post("/downloadbackground", urlencodedParser, function (request, response) {
    var response_dw_bg = response;
    if (!request.body || !request.file) return response.sendStatus(400);

    const img_path = path.join("uploads/", request.file.filename);
    const filename = request.file.originalname;

    try {
        fs.copyFileSync(img_path, path.join(directories.backgrounds, filename));
        invalidateThumbnail("bg", filename);
        response_dw_bg.send(filename);
    } catch (err) {
        console.error(err);
        response_dw_bg.sendStatus(500);
    }
});

app.post("/setbackground", jsonParser, function (request, response) {
    var bg = "#bg1 {background-image: url('../backgrounds/" + request.body.bg + "');}";
    fs.writeFile(path.join(baseDir, "public", "css", "bg_load.css"), bg, "utf8", function (err) {
        if (err) {
            response.send(err);
            return console.log(err);
        } else {
            //response.redirect("/");
            response.send({ result: "ok" });
        }
    });
});
app.post("/delbackground", jsonParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    if (request.body.bg !== sanitize(request.body.bg)) {
        console.error("Malicious bg name prevented");
        return response.sendStatus(403);
    }

    const fileName = path.join(directories.backgrounds, sanitize(request.body.bg));

    if (!fs.existsSync(fileName)) {
        console.log("BG file not found");
        return response.sendStatus(400);
    }

    fs.rmSync(fileName);
    invalidateThumbnail("bg", request.body.bg);
    return response.send("ok");
});

app.post("/getbackgrounds", jsonParser, function (_, response) {
    var images = getImages(path.join(baseDir, "public", "backgrounds"));
    response.send(JSON.stringify(images));
});
