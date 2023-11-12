import fs from "fs";
import path from "path";
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
    const worldInfo = JSON.parse(worldInfoText);
    return worldInfo;
}
