import fs from "fs";
import path from "path";
import mime from "mime-types";
import yauzl from "yauzl";
import { directories } from "./directories.js";

export async function getImageBuffers(zipFilePath: fs.PathLike): Promise<[string, Buffer][]> {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(zipFilePath)) {
            reject(new Error("File not found"));
            return;
        }

        const imageBuffers = [];

        yauzl.open(zipFilePath.toString(), { lazyEntries: true }, (err, zipfile) => {
            if (err) {
                reject(err);
            } else {
                zipfile.readEntry();
                zipfile.on("entry", (entry) => {
                    const mimeType = mime.lookup(entry.fileName);
                    if (mimeType && mimeType.startsWith("image/") && !entry.fileName.startsWith("__MACOSX")) {
                        console.log(`Extracting ${entry.fileName}`);
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err) {
                                reject(err);
                            } else {
                                const chunks = [];
                                readStream.on("data", (chunk) => {
                                    chunks.push(chunk);
                                });

                                readStream.on("end", () => {
                                    imageBuffers.push([path.parse(entry.fileName).base, Buffer.concat(chunks)]);
                                    zipfile.readEntry(); // Continue to the next entry
                                });
                            }
                        });
                    } else {
                        zipfile.readEntry(); // Continue to the next entry
                    }
                });

                zipfile.on("end", () => {
                    resolve(imageBuffers);
                });

                zipfile.on("error", (err) => {
                    reject(err);
                });
            }
        });
    });
}

export function invalidateThumbnail(type, file) {
    const folder = getThumbnailFolder(type);
    const pathToThumbnail = path.join(folder, file);

    if (fs.existsSync(pathToThumbnail)) {
        fs.rmSync(pathToThumbnail);
    }
}

export function getImages(path) {
    return fs
        .readdirSync(path)
        .filter((file) => {
            const type = mime.lookup(file);
            return type && type.startsWith("image/");
        })
        .sort(Intl.Collator().compare);
}

export function getPngName(file) {
    let i = 1;
    let base_name = file;
    while (fs.existsSync(path.join(directories.characters, file, ".png"))) {
        file = base_name + i;
        i++;
    }
    return file;
}

export function getThumbnailFolder(type) {
    let thumbnailFolder;

    switch (type) {
        case "bg":
            thumbnailFolder = directories.thumbnailsBg;
            break;
        case "avatar":
            thumbnailFolder = directories.thumbnailsAvatar;
            break;
    }

    return thumbnailFolder;
}
