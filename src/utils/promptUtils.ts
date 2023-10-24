import { readSecret } from "./common.js";
import { SECRET_KEYS } from "./constants.js";

// Prompt Conversion script taken from RisuAI by @kwaroran (GPLv3).
export function convertClaudePrompt(messages, addHumanPrefix, addAssistantPostfix) {
    // Claude doesn't support message names, so we'll just add them to the message content.
    for (const message of messages) {
        if (message.name && message.role !== "system") {
            message.content = message.name + ": " + message.content;
            delete message.name;
        }
    }

    let requestPrompt = messages
        .map((v) => {
            let prefix = "";
            switch (v.role) {
                case "assistant":
                    prefix = "\n\nAssistant: ";
                    break;
                case "user":
                    prefix = "\n\nHuman: ";
                    break;
                case "system":
                    // According to the Claude docs, H: and A: should be used for example conversations.
                    if (v.name === "example_assistant") {
                        prefix = "\n\nA: ";
                    } else if (v.name === "example_user") {
                        prefix = "\n\nH: ";
                    } else {
                        prefix = "\n\n";
                    }
                    break;
            }
            return prefix + v.content;
        })
        .join("");

    if (addHumanPrefix) {
        requestPrompt = "\n\nHuman: " + requestPrompt;
    }

    if (addAssistantPostfix) {
        requestPrompt = requestPrompt + "\n\nAssistant: ";
    }

    return requestPrompt;
}

export function get_mancer_headers() {
    const api_key_mancer = readSecret(SECRET_KEYS.MANCER);
    return api_key_mancer ? { "X-API-KEY": api_key_mancer } : {};
}
