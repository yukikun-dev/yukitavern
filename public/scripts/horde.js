import {
    saveSettingsDebounced,
    callPopup,
    setGenerationProgress,
    CLIENT_VERSION,
    getRequestHeaders,
} from "../script.js";
import { SECRET_KEYS, writeSecret } from "./secrets.js";
import { delay } from "./utils.js";
import { deviceInfo } from "./RossAscends-mods.js";

export {
    horde_settings,
    generateHorde,
    checkHordeStatus,
    loadHordeSettings,
    adjustHordeGenerationParams,
    getHordeModels,
    MIN_AMOUNT_GEN,
};

let models = [];

let horde_settings = {
    models: [],
    auto_adjust_response_length: true,
    auto_adjust_context_length: false,
    trusted_workers_only: false,
};

const MAX_RETRIES = 100;
const CHECK_INTERVAL = 3000;
const MIN_AMOUNT_GEN = 16;
const getRequestArgs = () => ({
    method: "GET",
    headers: {
        "Client-Agent": CLIENT_VERSION,
    },
});

async function getWorkers() {
    const response = await fetch(
        "https://horde.koboldai.net/api/v2/workers?type=text",
        getRequestArgs(),
    );
    const data = await response.json();
    return data;
}

function validateHordeModel() {
    let selectedModels = models.filter((m) =>
        horde_settings.models.includes(m.name),
    );

    if (selectedModels.length === 0) {
        toastr.warning(
            "No Horde model selected or the selected models are no longer available. Please choose another model",
        );
        throw new Error("No Horde model available");
    }

    return selectedModels;
}

async function adjustHordeGenerationParams(max_context_length, max_length) {
    const workers = await getWorkers();
    let maxContextLength = max_context_length;
    let maxLength = max_length;
    let availableWorkers = [];
    let selectedModels = validateHordeModel();

    if (selectedModels.length === 0) {
        return { maxContextLength, maxLength };
    }

    for (const model of selectedModels) {
        for (const worker of workers) {
            if (
                model.cluster == worker.cluster &&
                worker.models.includes(model.name)
            ) {
                availableWorkers.push(worker);
            }
        }
    }

    //get the minimum requires parameters, lowest common value for all selected
    for (const worker of availableWorkers) {
        if (horde_settings.auto_adjust_context_length) {
            maxContextLength = Math.min(
                worker.max_context_length,
                maxContextLength,
            );
        }
        if (horde_settings.auto_adjust_response_length) {
            maxLength = Math.min(worker.max_length, maxLength);
        }
    }

    return { maxContextLength, maxLength };
}

async function generateHorde(prompt, params, signal) {
    validateHordeModel();
    delete params.prompt;

    // No idea what these do
    params["n"] = 1;
    params["frmtadsnsp"] = false;
    params["frmtrmblln"] = false;
    params["frmtrmspch"] = false;
    params["frmttriminc"] = false;

    const payload = {
        prompt: prompt,
        params: params,
        trusted_workers: horde_settings.trusted_workers_only,
        //"slow_workers": false,
        models: horde_settings.models,
    };

    const response = await fetch("/generate_horde", {
        method: "POST",
        headers: {
            ...getRequestHeaders(),
            "Client-Agent": CLIENT_VERSION,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.json();
        callPopup(error.message, "text");
        throw new Error("Horde generation failed: " + error.message);
    }

    const responseJson = await response.json();
    const task_id = responseJson.id;
    let queue_position_first = null;
    console.log(`Horde task id = ${task_id}`);

    for (let retryNumber = 0; retryNumber < MAX_RETRIES; retryNumber++) {
        if (signal.aborted) {
            await fetch(
                `https://horde.koboldai.net/api/v2/generate/text/status/${task_id}`,
                {
                    method: "DELETE",
                    headers: {
                        "Client-Agent": CLIENT_VERSION,
                    },
                },
            );
            throw new Error("Request aborted");
        }

        const statusCheckResponse = await fetch(
            `https://horde.koboldai.net/api/v2/generate/text/status/${task_id}`,
            getRequestArgs(),
        );

        const statusCheckJson = await statusCheckResponse.json();
        console.log(statusCheckJson);

        if (
            statusCheckJson.done &&
            Array.isArray(statusCheckJson.generations) &&
            statusCheckJson.generations.length
        ) {
            setGenerationProgress(100);
            const generatedText = statusCheckJson.generations[0].text;
            const WorkerName = statusCheckJson.generations[0].worker_name;
            const WorkerModel = statusCheckJson.generations[0].model;
            console.log(generatedText);
            console.log(
                `Generated by Horde Worker: ${WorkerName} [${WorkerModel}]`,
            );
            return {
                text: generatedText,
                workerName: `Generated by Horde worker: ${WorkerName} [${WorkerModel}]`,
            };
        } else if (!queue_position_first) {
            queue_position_first = statusCheckJson.queue_position;
            setGenerationProgress(0);
        } else if (statusCheckJson.queue_position >= 0) {
            let queue_position = statusCheckJson.queue_position;
            const progress = Math.round(
                100 - (queue_position / queue_position_first) * 100,
            );
            setGenerationProgress(progress);
        }

        await delay(CHECK_INTERVAL);
    }

    callPopup("Horde request timed out. Try again", "text");
    throw new Error("Horde timeout");
}

async function checkHordeStatus() {
    const response = await fetch(
        "https://horde.koboldai.net/api/v2/status/heartbeat",
        getRequestArgs(),
    );
    return response.ok;
}

async function getHordeModels() {
    $("#horde_model").empty();
    const response = await fetch(
        "https://horde.koboldai.net/api/v2/status/models?type=text",
        getRequestArgs(),
    );
    models = await response.json();

    for (const model of models) {
        const option = document.createElement("option");
        option.value = model.name;
        option.innerText = `${model.name} (ETA: ${model.eta}s, Queue: ${model.queued}, Workers: ${model.count})`;
        option.selected = horde_settings.models.includes(model.name);
        $("#horde_model").append(option);
    }

    // if previously selected is no longer available
    if (
        horde_settings.models.length &&
        models.filter((m) => horde_settings.models.includes(m.name)).length ===
            0
    ) {
        horde_settings.models = [];
    }
}

function loadHordeSettings(settings) {
    if (settings.horde_settings) {
        Object.assign(horde_settings, settings.horde_settings);
    }

    $("#horde_auto_adjust_response_length").prop(
        "checked",
        horde_settings.auto_adjust_response_length,
    );
    $("#horde_auto_adjust_context_length").prop(
        "checked",
        horde_settings.auto_adjust_context_length,
    );
    $("#horde_trusted_workers_only").prop(
        "checked",
        horde_settings.trusted_workers_only,
    );
}

async function showKudos() {
    const response = await fetch("/horde_userinfo", {
        method: "POST",
        headers: getRequestHeaders(),
    });

    if (!response.ok) {
        toastr.warning(
            "Could not load user info from Horde. Please try again later.",
        );
        return;
    }

    const data = await response.json();

    if (data.anonymous) {
        toastr.info(
            "You are in anonymous mode. Set your personal Horde API key to see kudos.",
        );
        return;
    }

    console.log("Horde user data", data);
    toastr.info(`Kudos: ${data.kudos}`, data.username);
}

jQuery(function () {
    $("#horde_model").on("mousedown change", async function (e) {
        //desktop-only routine for multi-select without CTRL
        /*if (deviceInfo.device.type === 'desktop') {
            let hordeModelSelectScrollTop = null;
            e.preventDefault();
            const option = $(e.target);
            const selectElement = $(this)[0];
            hordeModelSelectScrollTop = selectElement.scrollTop;
            option.prop('selected', !option.prop('selected'));
            await delay(1);
            selectElement.scrollTop = hordeModelSelectScrollTop;
        }*/
        horde_settings.models = $("#horde_model").val();
        console.log("Updated Horde models", horde_settings.models);
    });

    $("#horde_auto_adjust_response_length").on("input", function () {
        horde_settings.auto_adjust_response_length = !!$(this).prop("checked");
        saveSettingsDebounced();
    });

    $("#horde_auto_adjust_context_length").on("input", function () {
        horde_settings.auto_adjust_context_length = !!$(this).prop("checked");
        saveSettingsDebounced();
    });

    $("#horde_trusted_workers_only").on("input", function () {
        horde_settings.trusted_workers_only = !!$(this).prop("checked");
        saveSettingsDebounced();
    });

    $("#horde_api_key").on("input", async function () {
        const key = $(this).val().trim();
        await writeSecret(SECRET_KEYS.HORDE, key);
    });

    $("#horde_refresh").on("click", getHordeModels);
    $("#horde_kudos").on("click", showKudos);

    // Not needed on mobile
    if (deviceInfo.device.type === "desktop") {
        $("#horde_model").select2({
            width: "100%",
            placeholder: "Select Horde models",
            allowClear: true,
            closeOnSelect: false,
            templateSelection: function (data) {
                // Customize the pillbox text by shortening the full text
                return data.id;
            },
            templateResult: function (data) {
                // Return the full text for the dropdown
                return data.text;
            },
        });
    }
});
