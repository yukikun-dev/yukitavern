import express from "express";
import fs from "fs";
import path from "path";
import { directories } from "../utils/directories.js";
import { jsonParser } from "../utils/common.js";

const app = express();
export default app;

app.get("/discover_extensions", jsonParser, function (_, response) {
    // get all folders in the extensions folder, except third-party
    const extensions = fs
        .readdirSync(directories.extensions)
        .filter((f) => fs.statSync(path.join(directories.extensions, f)).isDirectory())
        .filter((f) => f !== "third-party");

    // get all folders in the third-party folder, if it exists

    if (!fs.existsSync(path.join(directories.extensions, "third-party"))) {
        return response.send(extensions);
    }

    const thirdPartyExtensions = fs
        .readdirSync(path.join(directories.extensions, "third-party"))
        .filter((f) => fs.statSync(path.join(directories.extensions, "third-party", f)).isDirectory());

    // add the third-party extensions to the extensions array
    extensions.push(...thirdPartyExtensions.map((f) => `third-party/${f}`));
    console.log(extensions);

    return response.send(extensions);
});
