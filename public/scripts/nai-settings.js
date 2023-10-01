import {
    getRequestHeaders,
    saveSettingsDebounced,
    getStoppingStrings,
    getTextTokens,
} from "../script.js";
import { tokenizers } from "./power-user.js";

export { nai_settings, loadNovelPreset, loadNovelSettings, getNovelTier };

const default_preamble = "[ Style: chat, complex, sensory, visceral ]";

const nai_settings = {
    temperature: 0.5,
    repetition_penalty: 1,
    repetition_penalty_range: 100,
    repetition_penalty_slope: 0,
    repetition_penalty_frequency: 0,
    repetition_penalty_presence: 0,
    tail_free_sampling: 0.68,
    top_k: 0,
    top_p: 1,
    top_a: 1,
    typical_p: 1,
    min_length: 0,
    model_novel: "euterpe-v2",
    preset_settings_novel: "Classic-Euterpe",
    streaming_novel: false,
    nai_preamble: default_preamble,
};

const nai_tiers = {
    0: "Paper",
    1: "Tablet",
    2: "Scroll",
    3: "Opus",
};

let novel_data = null;

export function setNovelData(data) {
    novel_data = data;
}

export function getKayraMaxContextTokens() {
    switch (novel_data?.tier) {
        case 1:
            return 3072;
        case 2:
            return 6144;
        case 3:
            return 8192;
    }

    return null;
}

function getNovelTier(tier) {
    return nai_tiers[tier] ?? "no_connection";
}

function loadNovelPreset(preset) {
    $("#amount_gen").val(preset.max_length);
    $("#amount_gen_counter").text(`${preset.max_length}`);
    if (
        (preset.max_context > 2048 && !$("#max_context_unlocked")[0].checked) ||
        (preset.max_context <= 2048 && $("#max_context_unlocked")[0].checked)
    ) {
        $("#max_context_unlocked").click();
    }
    $("#max_context").val(preset.max_context);
    $("#max_context_counter").text(`${preset.max_context}`);
    $("#rep_pen_size_novel").attr("max", preset.max_context);

    nai_settings.temperature = preset.temperature;
    nai_settings.repetition_penalty = preset.repetition_penalty;
    nai_settings.repetition_penalty_range = preset.repetition_penalty_range;
    nai_settings.repetition_penalty_slope = preset.repetition_penalty_slope;
    nai_settings.repetition_penalty_frequency =
        preset.repetition_penalty_frequency;
    nai_settings.repetition_penalty_presence =
        preset.repetition_penalty_presence;
    nai_settings.tail_free_sampling = preset.tail_free_sampling;
    nai_settings.top_k = preset.top_k;
    nai_settings.top_p = preset.top_p;
    nai_settings.top_a = preset.top_a;
    nai_settings.typical_p = preset.typical_p;
    nai_settings.min_length = preset.min_length;
    nai_settings.cfg_scale = preset.cfg_scale;
    nai_settings.phrase_rep_pen = preset.phrase_rep_pen;
    nai_settings.top_g = preset.top_g;
    nai_settings.mirostat_lr = preset.mirostat_lr;
    nai_settings.mirostat_tau = preset.mirostat_tau;
    loadNovelSettingsUi(nai_settings);
}

function loadNovelSettings(settings) {
    //load the rest of the Novel settings without any checks
    nai_settings.model_novel = settings.model_novel;
    $(`#model_novel_select option[value=${nai_settings.model_novel}]`).attr(
        "selected",
        true,
    );
    $("#model_novel_select").val(nai_settings.model_novel);

    if (settings.nai_preamble !== undefined)
        nai_settings.preamble = settings.nai_preamble;
    nai_settings.preset_settings_novel = settings.preset_settings_novel;
    nai_settings.temperature = settings.temperature;
    nai_settings.repetition_penalty = settings.repetition_penalty;
    nai_settings.repetition_penalty_range = settings.repetition_penalty_range;
    nai_settings.repetition_penalty_slope = settings.repetition_penalty_slope;
    nai_settings.repetition_penalty_frequency =
        settings.repetition_penalty_frequency;
    nai_settings.repetition_penalty_presence =
        settings.repetition_penalty_presence;
    nai_settings.tail_free_sampling = settings.tail_free_sampling;
    nai_settings.top_k = settings.top_k;
    nai_settings.top_p = settings.top_p;
    nai_settings.top_a = settings.top_a;
    nai_settings.typical_p = settings.typical_p;
    nai_settings.min_length = settings.min_length;
    nai_settings.phrase_rep_pen = settings.phrase_rep_pen;
    nai_settings.cfg_scale = settings.cfg_scale;
    nai_settings.top_g = settings.top_g;
    nai_settings.mirostat_lr = settings.mirostat_lr;
    nai_settings.mirostat_tau = settings.mirostat_tau;
    nai_settings.streaming_novel = !!settings.streaming_novel;
    loadNovelSettingsUi(nai_settings);
}

const phraseRepPenStrings = [
    null,
    "very_light",
    "light",
    "medium",
    "aggressive",
    "very_aggressive",
];

function getPhraseRepPenString(phraseRepPenCounter) {
    if (phraseRepPenCounter < 1 || phraseRepPenCounter > 5) {
        return null;
    } else {
        return phraseRepPenStrings[phraseRepPenCounter];
    }
}

function getPhraseRepPenCounter(phraseRepPenString) {
    if (phraseRepPenString === phraseRepPenStrings[1]) {
        return 1;
    } else if (phraseRepPenString === phraseRepPenStrings[2]) {
        return 2;
    } else if (phraseRepPenString === phraseRepPenStrings[3]) {
        return 3;
    } else if (phraseRepPenString === phraseRepPenStrings[4]) {
        return 4;
    } else if (phraseRepPenString === phraseRepPenStrings[5]) {
        return 5;
    } else {
        return 0;
    }
}

function loadNovelSettingsUi(ui_settings) {
    $("#temp_novel").val(ui_settings.temperature);
    $("#temp_counter_novel").text(Number(ui_settings.temperature).toFixed(2));
    $("#rep_pen_novel").val(ui_settings.repetition_penalty);
    $("#rep_pen_counter_novel").text(
        Number(ui_settings.repetition_penalty).toFixed(2),
    );
    $("#rep_pen_size_novel").val(ui_settings.repetition_penalty_range);
    $("#rep_pen_size_counter_novel").text(
        Number(ui_settings.repetition_penalty_range).toFixed(0),
    );
    $("#rep_pen_slope_novel").val(ui_settings.repetition_penalty_slope);
    $("#rep_pen_slope_counter_novel").text(
        Number(`${ui_settings.repetition_penalty_slope}`).toFixed(2),
    );
    $("#rep_pen_freq_novel").val(ui_settings.repetition_penalty_frequency);
    $("#rep_pen_freq_counter_novel").text(
        Number(ui_settings.repetition_penalty_frequency).toFixed(5),
    );
    $("#rep_pen_presence_novel").val(ui_settings.repetition_penalty_presence);
    $("#rep_pen_presence_counter_novel").text(
        Number(ui_settings.repetition_penalty_presence).toFixed(3),
    );
    $("#tail_free_sampling_novel").val(ui_settings.tail_free_sampling);
    $("#tail_free_sampling_counter_novel").text(
        Number(ui_settings.tail_free_sampling).toFixed(3),
    );
    $("#top_k_novel").val(ui_settings.top_k);
    $("#top_k_counter_novel").text(Number(ui_settings.top_k).toFixed(0));
    $("#top_p_novel").val(ui_settings.top_p);
    $("#top_p_counter_novel").text(Number(ui_settings.top_p).toFixed(2));
    $("#top_a_novel").val(ui_settings.top_a);
    $("#top_a_counter_novel").text(Number(ui_settings.top_a).toFixed(2));
    $("#typical_p_novel").val(ui_settings.typical_p);
    $("#typical_p_counter_novel").text(
        Number(ui_settings.typical_p).toFixed(2),
    );
    $("#cfg_scale_novel").val(ui_settings.cfg_scale);
    $("#cfg_scale_counter_novel").text(
        Number(ui_settings.cfg_scale).toFixed(2),
    );
    $("#phrase_rep_pen_novel").val(
        getPhraseRepPenCounter(ui_settings.phrase_rep_pen),
    );
    $("#phrase_rep_pen_counter_novel").text(
        getPhraseRepPenCounter(ui_settings.phrase_rep_pen),
    );
    $("#top_g_novel").val(ui_settings.top_g);
    $("#top_g_counter_novel").text(Number(ui_settings.top_g).toFixed(0));
    $("#mirostat_lr_novel").val(ui_settings.mirostat_lr);
    $("#mirostat_lr_counter_novel").text(
        Number(ui_settings.mirostat_lr).toFixed(2),
    );
    $("#mirostat_tau_novel").val(ui_settings.mirostat_tau);
    $("#mirostat_tau_counter_novel").text(
        Number(ui_settings.mirostat_tau).toFixed(2),
    );
    $("#min_length_novel").val(ui_settings.min_length);
    $("#min_length_counter_novel").text(
        Number(ui_settings.min_length).toFixed(0),
    );
    $("#nai_preamble_textarea").val(ui_settings.nai_preamble);

    $("#streaming_novel").prop("checked", ui_settings.streaming_novel);
}

const sliders = [
    {
        sliderId: "#temp_novel",
        counterId: "#temp_counter_novel",
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => {
            nai_settings.temperature = Number(val).toFixed(2);
        },
    },
    {
        sliderId: "#rep_pen_novel",
        counterId: "#rep_pen_counter_novel",
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => {
            nai_settings.repetition_penalty = Number(val).toFixed(2);
        },
    },
    {
        sliderId: "#rep_pen_size_novel",
        counterId: "#rep_pen_size_counter_novel",
        format: (val) => `${val}`,
        setValue: (val) => {
            nai_settings.repetition_penalty_range = Number(val).toFixed(0);
        },
    },
    {
        sliderId: "#rep_pen_slope_novel",
        counterId: "#rep_pen_slope_counter_novel",
        format: (val) => `${val}`,
        setValue: (val) => {
            nai_settings.repetition_penalty_slope = Number(val).toFixed(2);
        },
    },
    {
        sliderId: "#rep_pen_freq_novel",
        counterId: "#rep_pen_freq_counter_novel",
        format: (val) => `${val}`,
        setValue: (val) => {
            nai_settings.repetition_penalty_frequency = Number(val).toFixed(5);
        },
    },
    {
        sliderId: "#rep_pen_presence_novel",
        counterId: "#rep_pen_presence_counter_novel",
        format: (val) => `${val}`,
        setValue: (val) => {
            nai_settings.repetition_penalty_presence = Number(val).toFixed(3);
        },
    },
    {
        sliderId: "#tail_free_sampling_novel",
        counterId: "#tail_free_sampling_counter_novel",
        format: (val) => `${val}`,
        setValue: (val) => {
            nai_settings.tail_free_sampling = Number(val).toFixed(3);
        },
    },
    {
        sliderId: "#top_k_novel",
        counterId: "#top_k_counter_novel",
        format: (val) => `${val}`,
        setValue: (val) => {
            nai_settings.top_k = Number(val).toFixed(0);
        },
    },
    {
        sliderId: "#top_p_novel",
        counterId: "#top_p_counter_novel",
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => {
            nai_settings.top_p = Number(val).toFixed(2);
        },
    },
    {
        sliderId: "#top_a_novel",
        counterId: "#top_a_counter_novel",
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => {
            nai_settings.top_a = Number(val).toFixed(2);
        },
    },
    {
        sliderId: "#typical_p_novel",
        counterId: "#typical_p_counter_novel",
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => {
            nai_settings.typical_p = Number(val).toFixed(2);
        },
    },
    {
        sliderId: "#top_g_novel",
        counterId: "#top_g_counter_novel",
        format: (val) => Number(val).toFixed(0),
        setValue: (val) => {
            nai_settings.top_g = Number(val).toFixed(0);
        },
    },
    {
        sliderId: "#mirostat_tau_novel",
        counterId: "#mirostat_tau_counter_novel",
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => {
            nai_settings.mirostat_tau = Number(val).toFixed(2);
        },
    },
    {
        sliderId: "#mirostat_lr_novel",
        counterId: "#mirostat_lr_counter_novel",
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => {
            nai_settings.mirostat_lr = Number(val).toFixed(2);
        },
    },
    {
        sliderId: "#cfg_scale_novel",
        counterId: "#cfg_scale_counter_novel",
        format: (val) => `${val}`,
        setValue: (val) => {
            nai_settings.cfg_scale = Number(val).toFixed(2);
        },
    },
    {
        sliderId: "#phrase_rep_pen_novel",
        counterId: "#phrase_rep_pen_counter_novel",
        format: (val) => `${val}`,
        setValue: (val) => {
            nai_settings.phrase_rep_pen = getPhraseRepPenString(
                Number(val).toFixed(0),
            );
        },
    },
    {
        sliderId: "#min_length_novel",
        counterId: "#min_length_counter_novel",
        format: (val) => `${val}`,
        setValue: (val) => {
            nai_settings.min_length = Number(val).toFixed(0);
        },
    },
];

export function getNovelGenerationData(
    finalPromt,
    this_settings,
    this_amount_gen,
    isImpersonate,
) {
    const clio = nai_settings.model_novel.includes("clio");
    const kayra = nai_settings.model_novel.includes("kayra");
    const isNewModel = clio || kayra;

    const tokenizerType = kayra
        ? tokenizers.NERD2
        : clio
        ? tokenizers.NERD
        : tokenizers.NONE;
    const stopSequences =
        tokenizerType !== tokenizers.NONE
            ? getStoppingStrings(isImpersonate, false).map((t) =>
                  getTextTokens(tokenizerType, t),
              )
            : undefined;

    let useInstruct = false;
    if (isNewModel) {
        // NovelAI claims they scan backwards 1000 characters (not tokens!) to look for instruct brackets. That's really short.
        const tail = finalPromt.slice(-1500);
        useInstruct = tail.includes("}");
    }

    return {
        input: finalPromt,
        model: nai_settings.model_novel,
        use_string: true,
        temperature: parseFloat(nai_settings.temperature),
        max_length: this_amount_gen, // this_settings.max_length, // <= why?
        min_length: parseInt(nai_settings.min_length),
        tail_free_sampling: parseFloat(nai_settings.tail_free_sampling),
        repetition_penalty: parseFloat(nai_settings.repetition_penalty),
        repetition_penalty_range: parseInt(
            nai_settings.repetition_penalty_range,
        ),
        repetition_penalty_slope: parseFloat(
            nai_settings.repetition_penalty_slope,
        ),
        repetition_penalty_frequency: parseFloat(
            nai_settings.repetition_penalty_frequency,
        ),
        repetition_penalty_presence: parseFloat(
            nai_settings.repetition_penalty_presence,
        ),
        top_a: parseFloat(nai_settings.top_a),
        top_p: parseFloat(nai_settings.top_p),
        top_k: parseInt(nai_settings.top_k),
        typical_p: parseFloat(nai_settings.typical_p),
        top_g: parseFloat(nai_settings.top_g),
        mirostat_lr: parseFloat(nai_settings.mirostat_lr),
        mirostat_tau: parseFloat(nai_settings.mirostat_tau),
        cfg_scale: parseFloat(nai_settings.cfg_scale),
        cfg_uc: "",
        phrase_rep_pen: nai_settings.phrase_rep_pen,
        //"stop_sequences": {{187}},
        stop_sequences: stopSequences,
        //bad_words_ids = {{50256}, {0}, {1}};
        generate_until_sentence: true,
        use_cache: false,
        use_string: true,
        return_full_text: false,
        prefix: useInstruct
            ? "special_instruct"
            : isNewModel
            ? "special_proseaugmenter"
            : "vanilla",
        order: this_settings.order,
        streaming: nai_settings.streaming_novel,
    };
}

export async function generateNovelWithStreaming(generate_data, signal) {
    const response = await fetch("/generate_novelai", {
        headers: getRequestHeaders(),
        body: JSON.stringify(generate_data),
        method: "POST",
        signal: signal,
    });

    return async function* streamData() {
        const decoder = new TextDecoder();
        const reader = response.body.getReader();
        let getMessage = "";
        let messageBuffer = "";
        while (true) {
            const { done, value } = await reader.read();
            let response = decoder.decode(value);
            let eventList = [];

            // ReadableStream's buffer is not guaranteed to contain full SSE messages as they arrive in chunks
            // We need to buffer chunks until we have one or more full messages (separated by double newlines)
            messageBuffer += response;
            eventList = messageBuffer.split("\n\n");
            // Last element will be an empty string or a leftover partial message
            messageBuffer = eventList.pop();

            for (let event of eventList) {
                for (let subEvent of event.split("\n")) {
                    if (subEvent.startsWith("data")) {
                        let data = JSON.parse(subEvent.substring(5));
                        getMessage += data?.token || "";
                        yield getMessage;
                    }
                }
            }

            if (done) {
                return;
            }
        }
    };
}

$("#nai_preamble_textarea").on("input", function () {
    nai_settings.preamble = $("#nai_preamble_textarea").val();
    saveSettingsDebounced();
});

$("#nai_preamble_restore").on("click", function () {
    nai_settings.preamble = default_preamble;
    $("#nai_preamble_textarea").val(nai_settings.preamble);
    saveSettingsDebounced();
});

$(document).ready(function () {
    sliders.forEach((slider) => {
        $(document).on("input", slider.sliderId, function () {
            const value = $(this).val();
            const formattedValue = slider.format(value);
            slider.setValue(value);
            $(slider.counterId).text(formattedValue);
            console.log("saving");
            saveSettingsDebounced();
        });
    });

    $("#streaming_novel").on("input", function () {
        const value = !!$(this).prop("checked");
        nai_settings.streaming_novel = value;
        saveSettingsDebounced();
    });

    $("#model_novel_select").change(function () {
        nai_settings.model_novel = $("#model_novel_select")
            .find(":selected")
            .val();
        saveSettingsDebounced();
    });
});
