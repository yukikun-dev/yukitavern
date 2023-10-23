import { getTokenizerModel, getTiktokenTokenizer } from "../utils/tokenizer.js";
import tiktoken from "@dqbd/tiktoken";
import { Tokenizer } from "@mlc-ai/web-tokenizers";
import express from "express";
import fs from "fs";
import { SentencePieceProcessor } from "sentencepiece-js";
import { jsonParser } from "../utils/common.js";
import { convertClaudePrompt } from "../utils/promptUtils.js";
import { api_server } from "./generateRoutes.js";
import { get_mancer_headers } from "../utils/promptUtils.js";

const CHARS_PER_TOKEN = 3.35;

const app = express();
export default app;

let claude_tokenizer = await loadClaudeTokenizer("./src/claude.min.json");
async function loadClaudeTokenizer(modelPath) {
    try {
        const arrayBuffer = fs.readFileSync(modelPath).buffer;
        const instance = await Tokenizer.fromJSON(arrayBuffer);
        return instance;
    } catch (error) {
        console.error("Claude tokenizer failed to load: " + modelPath, error);
        return null;
    }
}

function createTokenizationHandler(getTokenizerFn) {
    return async function (request, response) {
        if (!request.body) {
            return response.sendStatus(400);
        }

        const text = request.body.text || "";
        const tokenizer = getTokenizerFn();
        const { ids, count } = await countSentencepieceTokens(tokenizer, text);
        return response.send({ ids, count });
    };
}

async function countSentencepieceTokens(spp, text) {
    // Fallback to strlen estimation
    if (!spp) {
        return {
            ids: [],
            count: Math.ceil(text.length / CHARS_PER_TOKEN),
        };
    }

    let cleaned = text; // cleanText(text); <-- cleaning text can result in an incorrect tokenization

    let ids = spp.encodeIds(cleaned);
    return {
        ids,
        count: ids.length,
    };
}

let spp_llama;
let spp_nerd;
let spp_nerd_v2;

[spp_llama, spp_nerd, spp_nerd_v2] = await Promise.all([
    loadSentencepieceTokenizer("./src/sentencepiece/tokenizer.model"),
    loadSentencepieceTokenizer("./src/sentencepiece/nerdstash.model"),
    loadSentencepieceTokenizer("./src/sentencepiece/nerdstash_v2.model"),
]);

async function loadSentencepieceTokenizer(modelPath) {
    try {
        const spp = new SentencePieceProcessor();
        await spp.load(modelPath);
        return spp;
    } catch (error) {
        console.error("Sentencepiece tokenizer failed to load: " + modelPath, error);
        return null;
    }
}
app.post(
    "/tokenize_llama",
    jsonParser,
    createTokenizationHandler(() => spp_llama),
);
app.post(
    "/tokenize_nerdstash",
    jsonParser,
    createTokenizationHandler(() => spp_nerd),
);
app.post(
    "/tokenize_nerdstash_v2",
    jsonParser,
    createTokenizationHandler(() => spp_nerd_v2),
);
app.post("/tokenize_via_api", jsonParser, async function (request, response) {
    if (!request.body) {
        return response.sendStatus(400);
    }
    const text = request.body.text || "";

    try {
        const args = {
            body: JSON.stringify({ prompt: text }),
            headers: { "Content-Type": "application/json" },
        };

        const main_api = request.body.main_api;
        if (main_api == "textgenerationwebui" && request.body.use_mancer) {
            args.headers = Object.assign(args.headers, get_mancer_headers());
        }

        const data = await postAsync(api_server + "/v1/token-count", args);
        console.log(data);
        return response.send({ count: data["results"][0]["tokens"] });
    } catch (error) {
        console.log(error);
        return response.send({ error: true });
    }
});

async function postAsync(url, args) {
    const response = await fetch(url, { method: "POST", timeout: 0, ...args });

    if (response.ok) {
        const data = await response.json();
        return data;
    }

    throw response;
}

app.post("/tokenize_openai", jsonParser, function (request, response_tokenize_openai) {
    if (!request.body) return response_tokenize_openai.sendStatus(400);

    let num_tokens = 0;
    const model = getTokenizerModel(String(request.query.model || ""));

    if (model == "claude") {
        num_tokens = countClaudeTokens(claude_tokenizer, request.body);
        return response_tokenize_openai.send({ token_count: num_tokens });
    }

    const tokensPerName = model.includes("gpt-4") ? 1 : -1;
    const tokensPerMessage = model.includes("gpt-4") ? 3 : 4;
    const tokensPadding = 3;

    const tokenizer = getTiktokenTokenizer(model);

    for (const msg of request.body) {
        try {
            num_tokens += tokensPerMessage;
            for (const [key, value] of Object.entries(msg)) {
                num_tokens += tokenizer.encode(value).length;
                if (key == "name") {
                    num_tokens += tokensPerName;
                }
            }
        } catch {
            console.warn("Error tokenizing message:", msg);
        }
    }
    num_tokens += tokensPadding;

    // not needed for cached tokenizers
    //tokenizer.free();

    response_tokenize_openai.send({ token_count: num_tokens });
});

function countClaudeTokens(tokenizer, messages) {
    const convertedPrompt = convertClaudePrompt(messages, false, false);

    // Fallback to strlen estimation
    if (!tokenizer) {
        return Math.ceil(convertedPrompt.length / CHARS_PER_TOKEN);
    }

    const count = tokenizer.encode(convertedPrompt).length;
    return count;
}
