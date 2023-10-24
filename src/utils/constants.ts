import path from "path";
import { baseDir } from "./directories.js";

export const SECRETS_FILE = path.join(baseDir, "secrets.json");

export const SECRET_KEYS = {
    MANCER: "api_key_mancer",
    OPENAI: "api_key_openai",
    CLAUDE: "api_key_claude",
    DEEPL: "deepl",
    OPENROUTER: "api_key_openrouter",
};

export const AVATAR_WIDTH = 400;
export const AVATAR_HEIGHT = 600;
