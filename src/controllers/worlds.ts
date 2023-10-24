import fs from "fs";
import path from "path";
import json5 from "json5";
import { directories } from "../utils/directories.js";

export function readWorldInfoFile(worldInfoName) {
    if (!worldInfoName) {
        return { entries: {} };
    }

    const filename = `${worldInfoName}.json`;
    const pathToWorldInfo = path.join(directories.worlds, filename);

    if (!fs.existsSync(pathToWorldInfo)) {
        throw new Error(`World info file ${filename} doesn't exist.`);
    }

    const worldInfoText = fs.readFileSync(pathToWorldInfo, "utf8");
    const worldInfo = json5.parse(worldInfoText);
    return worldInfo;
}
