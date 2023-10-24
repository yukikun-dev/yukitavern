import fs from "fs";
import path from "path";
import util from "util";
const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);
import crypto from "crypto";

let charStats = {};
let lastSaveTimestamp = 0;
const statsFilePath = "../public/stats.json";

function timestampToMoment(timestamp: string): number | null {
    if (!timestamp) {
        return null;
    }

    if (typeof timestamp === "number") {
        return timestamp;
    }

    const pattern1 = /(\d{4})-(\d{1,2})-(\d{1,2}) @(\d{1,2})h (\d{1,2})m (\d{1,2})s (\d{1,3})ms/;
    const replacement1 = (
        match: any,
        year: any,
        month: string,
        day: string,
        hour: string,
        minute: string,
        second: string,
        millisecond: string,
    ) => {
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(
            2,
            "0",
        )}:${second.padStart(2, "0")}.${millisecond.padStart(3, "0")}Z`;
    };
    const isoTimestamp1 = timestamp.replace(pattern1, replacement1);
    if (!isNaN(new Date(isoTimestamp1).getTime())) {
        return new Date(isoTimestamp1).getTime();
    }

    const pattern2 = /(\w+)\s(\d{1,2}),\s(\d{4})\s(\d{1,2}):(\d{1,2})(am|pm)/i;
    const replacement2 = (
        match: any,
        month: string,
        day: string,
        year: any,
        hour: string,
        minute: string,
        meridiem: string,
    ) => {
        const monthNames = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ];
        const monthNum = monthNames.indexOf(month) + 1;
        const hour24 = meridiem.toLowerCase() === "pm" ? (parseInt(hour, 10) % 12) + 12 : parseInt(hour, 10) % 12;
        return `${year}-${monthNum.toString().padStart(2, "0")}-${day.padStart(2, "0")}T${hour24
            .toString()
            .padStart(2, "0")}:${minute.padStart(2, "0")}:00Z`;
    };
    const isoTimestamp2 = timestamp.replace(pattern2, replacement2);
    if (!isNaN(new Date(isoTimestamp2).getTime())) {
        return new Date(isoTimestamp2).getTime();
    }

    return null;
}

async function collectAndCreateStats(chatsPath: any, charactersPath: fs.PathLike): Promise<object> {
    console.log("Collecting and creating stats...");
    const files = await readdir(charactersPath);

    const pngFiles = files.filter((file) => file.endsWith(".png"));

    let processingPromises = pngFiles.map((file, index) => calculateStats(chatsPath, file));
    const statsArr = await Promise.all(processingPromises);

    let finalStats = {};
    for (let stat of statsArr) {
        finalStats = { ...finalStats, ...stat };
    }
    // tag with timestamp on when stats were generated
    finalStats = { ...finalStats, timestamp: Date.now() };
    return finalStats;
}

async function loadStatsFile(chatsPath: string, charactersPath: string) {
    try {
        const statsFileContent = await readFile(statsFilePath, "utf-8");
        charStats = JSON.parse(statsFileContent);
    } catch (err) {
        // If the file doesn't exist or is invalid, initialize stats
        if (err.code === "ENOENT" || err instanceof SyntaxError) {
            charStats = await collectAndCreateStats(chatsPath, charactersPath); // Call your function to collect and create stats
            await saveStatsToFile(charStats);
        } else {
            throw err; // Rethrow the error if it's something we didn't expect
        }
    }
    console.debug("Stats loaded from files.");
}

async function saveStatsToFile(charStats: { timestamp?: any }) {
    if (charStats && charStats.timestamp > lastSaveTimestamp) {
        await writeFile(statsFilePath, JSON.stringify(charStats));
        lastSaveTimestamp = Date.now();
    }
}

function readAndParseFile(filepath: fs.PathOrFileDescriptor): Array<string> {
    try {
        let file = fs.readFileSync(filepath, "utf8");
        let lines = file.split("\n");
        return lines;
    } catch (error) {
        console.error(`Error reading file at ${filepath}: ${error}`);
        return [];
    }
}

function calculateGenTime(gen_started: string | number | Date, gen_finished: string | number | Date): number {
    let startDate = new Date(gen_started);
    let endDate = new Date(gen_finished);
    return endDate.getTime() - startDate.getTime();
}

function countWordsInString(str: string): number {
    const match = str.match(/\b\w+\b/g);
    return match ? match.length : 0;
}

const calculateStats = (chatsPath: string, item: string): object => {
    const char_dir = path.join(chatsPath, item.replace(".png", ""));
    const stats = {
        total_gen_time: 0,
        user_word_count: 0,
        non_user_word_count: 0,
        user_msg_count: 0,
        non_user_msg_count: 0,
        total_swipe_count: 0,
        chat_size: 0,
        date_last_chat: 0,
        date_first_chat: new Date("9999-12-31T23:59:59.999Z").getTime(),
    };
    let uniqueGenStartTimes = new Set();

    if (fs.existsSync(char_dir)) {
        const chats = fs.readdirSync(char_dir);
        if (Array.isArray(chats) && chats.length) {
            for (const chat of chats) {
                const result = calculateTotalGenTimeAndWordCount(char_dir, chat, uniqueGenStartTimes);
                stats.total_gen_time += result.totalGenTime || 0;
                stats.user_word_count += result.userWordCount || 0;
                stats.non_user_word_count += result.nonUserWordCount || 0;
                stats.user_msg_count += result.userMsgCount || 0;
                stats.non_user_msg_count += result.nonUserMsgCount || 0;
                stats.total_swipe_count += result.totalSwipeCount || 0;

                const chatStat = fs.statSync(path.join(char_dir, chat));
                stats.chat_size += chatStat.size;
                stats.date_last_chat = Math.max(stats.date_last_chat, Math.floor(chatStat.mtimeMs));
                stats.date_first_chat = Math.min(stats.date_first_chat, result.firstChatTime);
            }
        }
    }

    return { [item]: stats };
};

function getCharStats(): object {
    return charStats;
}

function setCharStats(stats: {}) {
    charStats = stats;
    charStats = { ...charStats, timestamp: Date.now() };
}

function calculateTotalGenTimeAndWordCount(
    char_dir: string,
    chat: string,
    uniqueGenStartTimes: Set<unknown>,
): {
    totalGenTime: number;
    userWordCount: number;
    nonUserWordCount: number;
    userMsgCount: number;
    nonUserMsgCount: number;
    totalSwipeCount: number;
    firstChatTime: number;
} {
    let filepath = path.join(char_dir, chat);
    let lines = readAndParseFile(filepath);

    let totalGenTime = 0;
    let userWordCount = 0;
    let nonUserWordCount = 0;
    let nonUserMsgCount = 0;
    let userMsgCount = 0;
    let totalSwipeCount = 0;
    let firstChatTime = new Date("9999-12-31T23:59:59.999Z").getTime();

    for (let line of lines.entries()) {
        if (line.length) {
            try {
                let json = JSON.parse(line[1]);
                if (json.mes) {
                    let hash = crypto.createHash("sha256").update(json.mes).digest("hex");
                    if (uniqueGenStartTimes.has(hash)) {
                        continue;
                    }
                    if (hash) {
                        uniqueGenStartTimes.add(hash);
                    }
                }

                if (json.gen_started && json.gen_finished) {
                    let genTime = calculateGenTime(json.gen_started, json.gen_finished);
                    totalGenTime += genTime;

                    if (json.swipes && !json.swipe_info) {
                        // If there are swipes but no swipe_info, estimate the genTime
                        totalGenTime += genTime * json.swipes.length;
                    }
                }

                if (json.mes) {
                    let wordCount = countWordsInString(json.mes);
                    json.is_user ? (userWordCount += wordCount) : (nonUserWordCount += wordCount);
                    json.is_user ? userMsgCount++ : nonUserMsgCount++;
                }

                if (json.swipes && json.swipes.length > 1) {
                    totalSwipeCount += json.swipes.length - 1; // Subtract 1 to not count the first swipe
                    for (let i = 1; i < json.swipes.length; i++) {
                        // Start from the second swipe
                        let swipeText = json.swipes[i];

                        let wordCount = countWordsInString(swipeText);
                        json.is_user ? (userWordCount += wordCount) : (nonUserWordCount += wordCount);
                        json.is_user ? userMsgCount++ : nonUserMsgCount++;
                    }
                }

                if (json.swipe_info && json.swipe_info.length > 1) {
                    for (let i = 1; i < json.swipe_info.length; i++) {
                        // Start from the second swipe
                        let swipe = json.swipe_info[i];
                        if (swipe.gen_started && swipe.gen_finished) {
                            totalGenTime += calculateGenTime(swipe.gen_started, swipe.gen_finished);
                        }
                    }
                }

                // If this is the first user message, set the first chat time
                if (json.is_user) {
                    //get min between firstChatTime and timestampToMoment(json.send_date)
                    firstChatTime = Math.min(timestampToMoment(json.send_date), firstChatTime);
                }
            } catch (error) {
                console.error(`Error parsing line ${line}: ${error}`);
            }
        }
    }
    return {
        totalGenTime,
        userWordCount,
        nonUserWordCount,
        userMsgCount,
        nonUserMsgCount,
        totalSwipeCount,
        firstChatTime,
    };
}

export {
    saveStatsToFile,
    loadStatsFile,
    getCharStats,
    setCharStats,
    calculateStats,
    calculateTotalGenTimeAndWordCount,
    timestampToMoment,
};
