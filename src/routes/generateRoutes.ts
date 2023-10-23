import express from "express";
import { jsonParser } from "../utils/common.js";
import _ from "lodash";
import { postAsync } from "../utils/common.js";
import json5 from "json5";
import { get_mancer_headers } from "../utils/promptUtils.js";
import WebSocket from "ws";
import { Client } from "node-rest-client";

export var api_server = "http://0.0.0.0:5000";

const app = express();
export default app;

app.post("/generate_textgenerationwebui", jsonParser, async function (request, response_generate) {
    if (!request.body) return response_generate.sendStatus(400);

    console.log(request.body);

    const controller = new AbortController();
    let isGenerationStopped = false;
    request.socket.removeAllListeners("close");
    request.socket.on("close", function () {
        isGenerationStopped = true;
        controller.abort();
    });

    if (request.header("X-Response-Streaming")) {
        response_generate.writeHead(200, {
            "Content-Type": "text/plain;charset=utf-8",
            "Transfer-Encoding": "chunked",
            "Cache-Control": "no-transform",
        });

        async function* readWebsocket() {
            const streamingUrl = request.header("X-Streaming-URL");
            const websocket = new WebSocket(streamingUrl);

            websocket.on("open", async function () {
                console.log("websocket open");
                websocket.send(JSON.stringify(request.body));
            });

            websocket.on("error", (err) => {
                console.error(err);
                websocket.close();
            });

            websocket.on("close", (code, buffer) => {
                const reason = new TextDecoder().decode(buffer);
                console.log(reason);
            });

            while (true) {
                if (isGenerationStopped) {
                    console.error("Streaming stopped by user. Closing websocket...");
                    websocket.close();
                    return;
                }

                const rawMessage = (await new Promise((resolve) => websocket.once("message", resolve))) as string;
                const message = json5.parse(rawMessage);

                switch (message.event) {
                    case "text_stream":
                        yield message.text;
                        break;
                    case "stream_end":
                        websocket.close();
                        return;
                }
            }
        }

        let reply = "";

        try {
            for await (const text of readWebsocket()) {
                if (typeof text !== "string") {
                    break;
                }

                let newText = text;

                if (!newText) {
                    continue;
                }

                reply += text;
                response_generate.write(newText);
            }

            console.log(reply);
        } finally {
            response_generate.end();
        }
    } else {
        const args = {
            body: JSON.stringify(request.body),
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
        };

        if (request.body.use_mancer) {
            args.headers = Object.assign(args.headers, get_mancer_headers());
        }

        try {
            const data = await postAsync(api_server + "/v1/generate", args);
            console.log(data);
            return response_generate.send(data);
        } catch (error) {
            var retval = {
                error: true,
                status: error.status,
                response: error.statusText,
            };
            console.log(error);
            try {
                retval.response = await error.json();
                retval.response = retval.response.result;
            } catch {
                _.noop();
            }
            return response_generate.send(retval);
        }
    }
});

app.post("/getstatus", jsonParser, async function (request, response_getstatus) {
    if (!request.body) return response_getstatus.sendStatus(400);
    api_server = request.body.api_server;
    const main_api = request.body.main_api;
    if (api_server.indexOf("localhost") != -1) {
        api_server = api_server.replace("localhost", "127.0.0.1");
    }
    var args = {
        headers: { "Content-Type": "application/json" },
    };

    if (main_api == "textgenerationwebui" && request.body.use_mancer) {
        args.headers = Object.assign(args.headers, get_mancer_headers());
    }

    var url = api_server + "/v1/model";
    let version = "";
    const client = new Client();
    client
        .get(url, args, async function (data, response) {
            if (typeof data !== "object") {
                data = {};
            }
            if (response.statusCode == 200) {
                data.version = version;
                if (data.result == "ReadOnly") {
                    data.result = "no_connection";
                }
            } else {
                data.response = data.result;
                data.result = "no_connection";
            }
            response_getstatus.send(data);
        })
        .on("error", function () {
            response_getstatus.send({ result: "no_connection" });
        });
});
