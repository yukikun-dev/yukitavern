import { Client } from "node-rest-client";
import express from "express";
import fs from "fs";
import path from "path";
import { directories } from "../utils/directories.js";
import { jsonParser } from "../utils/common.js";
import { tryParse } from "../utils/common.js";
import { SECRET_KEYS } from "../utils/constants.js";
import { readSecret } from "../utils/common.js";
import { convertClaudePrompt } from "../utils/promptUtils.js";
import axios from "axios";
import { getTokenizerModel, getTiktokenTokenizer } from "../utils/tokenizer.js";
import { Readable } from "stream";

const app = express();
export default app;

let api_openai = "https://api.openai.com/v1";

app.post("/generate_openai", jsonParser, function (request, response_generate_openai) {
    if (!request.body) return response_generate_openai.status(400).send({ error: true });

    if (request.body.use_claude) {
        return sendClaudeRequest(request, response_generate_openai);
    }

    let api_url;
    let api_key_openai;
    let headers;
    let bodyParams;

    if (!request.body.use_openrouter) {
        api_url = new URL(request.body.reverse_proxy || api_openai).toString();
        api_key_openai = request.body.reverse_proxy ? request.body.proxy_password : readSecret(SECRET_KEYS.OPENAI);
        headers = {};
        bodyParams = {};
    } else {
        api_url = "https://openrouter.ai/api/v1";
        api_key_openai = readSecret(SECRET_KEYS.OPENROUTER);
        // OpenRouter needs to pass the referer: https://openrouter.ai/docs
        headers = { "HTTP-Referer": request.headers.referer };
        bodyParams = { transforms: ["middle-out"] };
    }

    if (!api_key_openai && !request.body.reverse_proxy) {
        return response_generate_openai.status(401).send({ error: true });
    }

    const isTextCompletion = Boolean(
        request.body.model && (request.body.model.startsWith("text-") || request.body.model.startsWith("code-")),
    );
    const textPrompt = isTextCompletion ? convertChatMLPrompt(request.body.messages) : "";
    const endpointUrl = isTextCompletion ? `${api_url}/completions` : `${api_url}/chat/completions`;

    const controller = new AbortController();
    request.socket.removeAllListeners("close");
    request.socket.on("close", function () {
        controller.abort();
    });

    var config = {
        method: "post",
        url: endpointUrl,
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + api_key_openai,
            ...headers,
        },
        data: {
            messages: isTextCompletion === false ? request.body.messages : undefined,
            prompt: isTextCompletion === true ? textPrompt : undefined,
            model: request.body.model,
            temperature: request.body.temperature,
            max_tokens: request.body.max_tokens,
            stream: request.body.stream,
            presence_penalty: request.body.presence_penalty,
            frequency_penalty: request.body.frequency_penalty,
            top_p: request.body.top_p,
            top_k: request.body.top_k,
            stop: request.body.stop,
            logit_bias: request.body.logit_bias,
            ...bodyParams,
        },
        signal: controller.signal,
        responseType: "json",
    };

    console.log(config.data);

    if (request.body.stream) {
        config.responseType = "stream";
    }

    async function makeRequest(config, response_generate_openai, request, retries = 5, timeout = 1000) {
        try {
            const response = await axios(config);

            if (response.status <= 299) {
                if (request.body.stream) {
                    console.log("Streaming request in progress");
                    response.data.pipe(response_generate_openai);
                    response.data.on("end", () => {
                        console.log("Streaming request finished");
                        response_generate_openai.end();
                    });
                } else {
                    response_generate_openai.send(response.data);
                    console.log(response.data);
                    console.log(response.data?.choices[0]?.message);
                }
            } else {
                handleErrorResponse(response, response_generate_openai);
            }
        } catch (error) {
            if (error.response && error.response.status === 429 && retries > 0) {
                console.log("Out of quota, retrying...");
                setTimeout(() => {
                    makeRequest(config, response_generate_openai, request, retries - 1);
                }, timeout);
            } else {
                let errorData = error?.response?.data;

                if (request.body.stream) {
                    try {
                        const chunks = await readAllChunks(errorData);
                        const blob = new Blob(chunks as BlobPart[], {
                            type: "application/json",
                        });
                        const text = await blob.text();
                        errorData = JSON.parse(text);
                    } catch {
                        console.warn("Error parsing streaming response");
                    }
                } else {
                    errorData = typeof errorData === "string" ? tryParse(errorData) : errorData;
                }

                handleError(error, response_generate_openai, errorData);
            }
        }
    }

    function handleErrorResponse(response, response_generate_openai) {
        if (response.status >= 400 && response.status <= 504) {
            console.log("Error occurred:", response.status, response.data);
            response_generate_openai.send({ error: true });
        }
    }

    function handleError(error, response_generate_openai, errorData) {
        console.error("Error:", error?.message);

        let message = error?.response?.statusText;

        const statusMessages = {
            400: "Bad request",
            401: "Unauthorized",
            402: "Credit limit reached",
            403: "Forbidden",
            404: "Not found",
            429: "Too many requests",
            451: "Unavailable for legal reasons",
        };

        const status = error?.response?.status;
        if (statusMessages.hasOwnProperty(status)) {
            message = errorData?.error?.message || statusMessages[status];
            console.log(message);
        }

        const quota_error = error?.response?.status === 429 && errorData?.error?.type === "insufficient_quota";
        const response = { error: { message }, quota_error: quota_error };
        if (!response_generate_openai.headersSent) {
            response_generate_openai.send(response);
        } else if (!response_generate_openai.writableEnded) {
            response_generate_openai.write(response);
        }
    }

    makeRequest(config, response_generate_openai, request);
});

app.post("/getstatus_openai", jsonParser, function (request, response_getstatus_openai) {
    if (!request.body) return response_getstatus_openai.sendStatus(400);

    let api_url: string;
    let api_key_openai: string;
    let headers: { "HTTP-Referer"?: string };

    if (request.body.use_openrouter == false) {
        api_url = new URL(request.body.reverse_proxy || api_openai).toString();
        api_key_openai = request.body.reverse_proxy ? request.body.proxy_password : readSecret(SECRET_KEYS.OPENAI);
        headers = {};
    } else {
        api_url = "https://openrouter.ai/api/v1";
        api_key_openai = readSecret(SECRET_KEYS.OPENROUTER);
        // OpenRouter needs to pass the referer: https://openrouter.ai/docs
        headers = { "HTTP-Referer": request.headers.referer };
    }

    if (!api_key_openai && !request.body.reverse_proxy) {
        return response_getstatus_openai.status(401).send({ error: true });
    }

    const args = {
        headers: {
            Authorization: "Bearer " + api_key_openai,
            ...headers,
        },
    };
    const client = new Client();
    client
        .get(api_url + "/models", args, function (data, response) {
            if (response.statusCode == 200) {
                response_getstatus_openai.send(data);
                if (request.body.use_openrouter) {
                    let models: { [key: string]: { tokens_per_dollar: string; context_length: any } } = {};
                    data.data.forEach(
                        (model: { context_length: any; pricing: { prompt: number }; id: string | number }) => {
                            const context_length = model.context_length;
                            const tokens_dollar = parseFloat((1 / (1000 * model.pricing.prompt)).toString());
                            const tokens_rounded = (Math.round(tokens_dollar * 1000) / 1000).toFixed(0);
                            models[model.id.toString()] = {
                                tokens_per_dollar: tokens_rounded + "k",
                                context_length: context_length,
                            };
                        },
                    );
                    console.log("Available OpenRouter models:", models);
                } else {
                    const modelIds = data?.data?.map((x) => x.id)?.sort();
                    console.log("Available OpenAI models:", modelIds);
                }
            }
            if (response.statusCode == 401) {
                console.log("Access Token is incorrect.");
                response_getstatus_openai.send({ error: true });
            }
            if (response.statusCode == 404) {
                console.log("Endpoint not found.");
                response_getstatus_openai.send({ error: true });
            }
            if (
                response.statusCode == 500 ||
                response.statusCode == 501 ||
                response.statusCode == 501 ||
                response.statusCode == 503 ||
                response.statusCode == 507
            ) {
                console.log(data);
                response_getstatus_openai.send({ error: true });
            }
        })
        .on("error", function () {
            response_getstatus_openai.send({ error: true });
        });
});

app.post("/openai_bias", jsonParser, async function (request, response) {
    if (!request.body || !Array.isArray(request.body)) return response.sendStatus(400);

    let result = {};

    const model = getTokenizerModel(String(request.query.model || ""));

    // no bias for claude
    if (model == "claude") {
        return response.send(result);
    }

    const tokenizer = getTiktokenTokenizer(model);

    for (const entry of request.body) {
        if (!entry || !entry.text) {
            continue;
        }

        try {
            const tokens = tokenizer.encode(entry.text);

            for (const token of tokens) {
                result[token] = entry.value;
            }
        } catch {
            console.warn("Tokenizer failed to encode:", entry.text);
        }
    }

    // not needed for cached tokenizers
    //tokenizer.free();
    return response.send(result);
});

app.post("/deletepreset_openai", jsonParser, function (request, response) {
    if (!request.body || !request.body.name) {
        return response.sendStatus(400);
    }

    const name = request.body.name;
    const pathToFile = path.join(directories.openAI_Settings, `${name}.settings`);

    if (fs.existsSync(pathToFile)) {
        fs.rmSync(pathToFile);
        return response.send({ ok: true });
    }

    return response.send({ error: true });
});
let api_claude = "https://api.anthropic.com/v1";
async function sendClaudeRequest(request, response) {
    const api_url = new URL(request.body.reverse_proxy || api_claude).toString();
    const api_key_claude = request.body.reverse_proxy ? request.body.proxy_password : readSecret(SECRET_KEYS.CLAUDE);

    if (!api_key_claude) {
        return response.status(401).send({ error: true });
    }

    try {
        const controller = new AbortController();
        request.socket.removeAllListeners("close");
        request.socket.on("close", function () {
            controller.abort();
        });

        let requestPrompt = convertClaudePrompt(request.body.messages, true, !request.body.exclude_assistant);

        if (request.body.assistant_prefill && !request.body.exclude_assistant) {
            requestPrompt += request.body.assistant_prefill;
        }

        console.log("Claude request:", requestPrompt);

        const generateResponse = await fetch(api_url + "/complete", {
            method: "POST",
            signal: controller.signal,
            body: JSON.stringify({
                prompt: requestPrompt,
                model: request.body.model,
                max_tokens_to_sample: request.body.max_tokens,
                stop_sequences: ["\n\nHuman:", "\n\nSystem:", "\n\nAssistant:"],
                temperature: request.body.temperature,
                top_p: request.body.top_p,
                top_k: request.body.top_k,
                stream: request.body.stream,
            }),
            headers: {
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01",
                "x-api-key": api_key_claude,
            },
        });

        if (request.body.stream) {
            if (generateResponse.body instanceof ReadableStream) {
                const reader = generateResponse.body.getReader();

                // Pump the stream data to your response
                const pump = async () => {
                    const { value, done } = await reader.read();
                    if (done) {
                        console.log("Streaming request finished");
                        response.end();
                        return;
                    }

                    // Write the chunk to the response
                    response.write(value);
                    pump(); // Recursively call pump until stream is exhausted
                };

                pump();

                request.socket.on("close", function () {
                    reader.cancel(); // Cancel the WHATWG stream
                    response.end();
                });
            } else {
                // Handle other types of streams
                // For example, if it was a Node.js stream, you'd handle it differently
            }
        } else {
            if (!generateResponse.ok) {
                console.log(
                    `Claude API returned error: ${generateResponse.status} ${
                        generateResponse.statusText
                    } ${await generateResponse.text()}`,
                );
                return response.status(generateResponse.status).send({ error: true });
            }

            const generateResponseJson = await generateResponse.json();
            const responseText = generateResponseJson.completion;
            console.log("Claude response:", responseText);

            // Wrap it back to OAI format
            const reply = { choices: [{ message: { content: responseText } }] };
            return response.send(reply);
        }
    } catch (error) {
        console.log("Error communicating with Claude: ", error);
        if (!response.headersSent) {
            return response.status(500).send({ error: true });
        }
    }
}

async function readAllChunks(readableStream) {
    return new Promise((resolve, reject) => {
        // Consume the readable stream
        const chunks = [];
        readableStream.on("data", (chunk) => {
            chunks.push(chunk);
        });

        readableStream.on("end", () => {
            console.log("Finished reading the stream.");
            resolve(chunks);
        });

        readableStream.on("error", (error) => {
            console.error("Error while reading the stream:", error);
            reject();
        });
    });
}

function convertChatMLPrompt(messages) {
    const messageStrings = [];
    messages.forEach((m) => {
        if (m.role === "system" && m.name === undefined) {
            messageStrings.push("System: " + m.content);
        } else if (m.role === "system" && m.name !== undefined) {
            messageStrings.push(m.name + ": " + m.content);
        } else {
            messageStrings.push(m.role + ": " + m.content);
        }
    });
    return messageStrings.join("\n");
}
