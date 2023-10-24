import { readFileSync, existsSync, cpSync, writeFileSync } from "fs";
import { join } from "path";
import { cwd } from "process";
const contentDirectory = join(cwd(), "default/content");
const contentLogPath = join(contentDirectory, "content.log");
const contentIndexPath = join(contentDirectory, "index.json");

function checkForNewContent() {
    try {
        const contentLog = getContentLog();
        const contentIndexText = readFileSync(contentIndexPath, "utf8");
        const contentIndex = JSON.parse(contentIndexText);

        for (const contentItem of contentIndex) {
            // If the content item is already in the log, skip it
            if (contentLog.includes(contentItem.filename)) {
                continue;
            }

            contentLog.push(contentItem.filename);
            const contentPath = join(contentDirectory, contentItem.filename);

            if (!existsSync(contentPath)) {
                console.log(`Content file ${contentItem.filename} is missing`);
                continue;
            }

            const contentTarget = getTargetByType(contentItem.type);

            if (!contentTarget) {
                console.log(`Content file ${contentItem.filename} has unknown type ${contentItem.type}`);
                continue;
            }

            const targetPath = join(cwd(), contentTarget, contentItem.filename);

            if (existsSync(targetPath)) {
                console.log(`Content file ${contentItem.filename} already exists in ${contentTarget}`);
                continue;
            }

            cpSync(contentPath, targetPath, {
                recursive: true,
                force: false,
            });
            console.log(`Content file ${contentItem.filename} copied to ${contentTarget}`);
        }

        writeFileSync(contentLogPath, contentLog.join("\n"));
    } catch (err) {
        console.log("Content check failed", err);
    }
}

function getTargetByType(type) {
    switch (type) {
        case "character":
            return "public/characters";
        case "sprites":
            return "public/characters";
        case "background":
            return "public/backgrounds";
        case "world":
            return "public/worlds";
        case "sound":
            return "public/sounds";
        case "avatar":
            return "public/User Avatars";
        case "theme":
            return "public/themes";
        default:
            return null;
    }
}

function getContentLog() {
    if (!existsSync(contentLogPath)) {
        return [];
    }

    const contentLogText = readFileSync(contentLogPath, "utf8");
    return contentLogText.split("\n");
}

export default {
    checkForNewContent,
};
