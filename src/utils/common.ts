import express from "express";
import json5 from "json5";
import fs from "fs";
import { SECRETS_FILE } from "./constants.js";

export const jsonParser = express.json({ limit: "100mb" });
export const urlencodedParser = express.urlencoded({ extended: true, limit: "100mb" });

export async function postAsync(url, args) {
    const response = await fetch(url, { method: "POST", timeout: 0, ...args });

    if (response.ok) {
        const data = await response.json();
        return data;
    }

    throw response;
}

export function humanizedISO8601DateTime() {
    let baseDate = new Date(Date.now());
    let humanYear = baseDate.getFullYear();
    let humanMonth = baseDate.getMonth() + 1;
    let humanDate = baseDate.getDate();
    let humanHour = (baseDate.getHours() < 10 ? "0" : "") + baseDate.getHours();
    let humanMinute = (baseDate.getMinutes() < 10 ? "0" : "") + baseDate.getMinutes();
    let humanSecond = (baseDate.getSeconds() < 10 ? "0" : "") + baseDate.getSeconds();
    let humanMillisecond = (baseDate.getMilliseconds() < 10 ? "0" : "") + baseDate.getMilliseconds();
    let HumanizedDateTime =
        humanYear +
        "-" +
        humanMonth +
        "-" +
        humanDate +
        " @" +
        humanHour +
        "h " +
        humanMinute +
        "m " +
        humanSecond +
        "s " +
        humanMillisecond +
        "ms";
    return HumanizedDateTime;
}

export function tryParse(str) {
    try {
        return json5.parse(str);
    } catch {
        return undefined;
    }
}

export function readSecret(key) {
    if (!fs.existsSync(SECRETS_FILE)) {
        return undefined;
    }

    const fileContents = fs.readFileSync(SECRETS_FILE);
    const secrets = JSON.parse(fileContents.toString());
    return secrets[key];
}
