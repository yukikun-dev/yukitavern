import fs from "fs";

import extract from "png-chunks-extract";
import PNGtext from "png-chunk-text";
import { Buffer } from "buffer";

export async function parse(cardUrl: fs.PathOrFileDescriptor, format: string) {
    var fileFormat = format ? format : "png";

    switch (fileFormat) {
        case "png":
            const buffer = fs.readFileSync(cardUrl);
            const chunks = extract(buffer);

            const textChunks = chunks
                .filter(function (chunk: { name: string }) {
                    return chunk.name === "tEXt";
                })
                .map(function (chunk: { data: any }) {
                    return PNGtext.decode(chunk.data);
                });

            if (textChunks.length === 0) {
                console.error("PNG metadata does not contain any character data.");
                throw new Error("No PNG metadata.");
            }

            return Buffer.from(textChunks[0].text, "base64").toString("utf8");
        default:
            break;
    }
}
