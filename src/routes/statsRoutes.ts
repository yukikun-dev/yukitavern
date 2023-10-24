import express from "express";
import { jsonParser } from "../utils/common.js";
import * as statsHelpers from "../statsHelpers.js";

const app = express();
export default app;
app.post("/getstats", jsonParser, function (_, response) {
    response.send(JSON.stringify(statsHelpers.getCharStats()));
});

app.post("/updatestats", jsonParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);
    statsHelpers.setCharStats(request.body);
    return response.sendStatus(200);
});
