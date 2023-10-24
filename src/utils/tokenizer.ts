import tiktoken from "@dqbd/tiktoken";

export function getTokenizerModel(requestModel) {
    if (requestModel.includes("claude")) {
        return "claude";
    }

    if (requestModel.includes("gpt-4-32k")) {
        return "gpt-4-32k";
    }

    if (requestModel.includes("gpt-4")) {
        return "gpt-4";
    }

    if (requestModel.includes("gpt-3.5-turbo")) {
        return "gpt-3.5-turbo";
    }

    if (requestModel.startsWith("text-") || requestModel.startsWith("code-")) {
        return requestModel;
    }

    // default
    return "gpt-3.5-turbo";
}
const tokenizersCache = {};

export function getTiktokenTokenizer(model) {
    if (tokenizersCache[model]) {
        return tokenizersCache[model];
    }

    const tokenizer = tiktoken.encoding_for_model(model);
    console.log("Instantiated the tokenizer for", model);
    tokenizersCache[model] = tokenizer;
    return tokenizer;
}
