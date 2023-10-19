import config from "../config.json";
import { Buffer } from "buffer";

const unauthorizedResponse = (res) => {
    res.set("WWW-Authenticate", 'Basic realm="yukitavern", charset="UTF-8"');
    return res.status(401).send("Authentication required");
};

export default function basicAuthMiddleware(request, response, callback) {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
        return unauthorizedResponse(response);
    }

    const [scheme, credentials] = authHeader.split(" ");

    if (scheme !== "Basic" || !credentials) {
        return unauthorizedResponse(response);
    }

    const [username, password] = Buffer.from(credentials, "base64").toString("utf8").split(":");

    if (username === config.basicAuthUser.username && password === config.basicAuthUser.password) {
        return callback();
    } else {
        return unauthorizedResponse(response);
    }
}
