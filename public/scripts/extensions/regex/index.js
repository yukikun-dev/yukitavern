import {
    callPopup,
    eventSource,
    event_types,
    getCurrentChatId,
    reloadCurrentChat,
    saveSettingsDebounced,
} from "../../../script.js";
import { extension_settings } from "../../extensions.js";
import { uuidv4, waitUntilCondition } from "../../utils.js";
import { regex_placement } from "./engine.js";

async function saveRegexScript(regexScript, existingScriptIndex) {
    // If not editing

    // Is the script name undefined or empty?
    if (!regexScript.scriptName) {
        toastr.error(`Could not save regex script: The script name was undefined or empty!`);
        return;
    }

    if (existingScriptIndex === -1) {
        // Does the script name already exist?
        if (extension_settings.regex.find((e) => e.scriptName === regexScript.scriptName)) {
            toastr.error(`Could not save regex script: A script with name ${regexScript.scriptName} already exists.`);
            return;
        }
    } else {
        // Does the script name already exist somewhere else?
        // (If this fails, make it a .filter().map() to index array)
        const foundIndex = extension_settings.regex.findIndex((e) => e.scriptName === regexScript.scriptName);
        if (foundIndex !== existingScriptIndex && foundIndex !== -1) {
            toastr.error(`Could not save regex script: A script with name ${regexScript.scriptName} already exists.`);
            return;
        }
    }

    // Is a find regex present?
    if (regexScript.findRegex.length === 0) {
        toastr.warning(`This regex script will not work, but was saved anyway: A find regex isn't present.`);
    }

    // Is there someplace to place results?
    if (regexScript.placement.length === 0) {
        toastr.warning(
            `This regex script will not work, but was saved anyway: One "Affects" checkbox must be selected!`,
        );
    }

    if (existingScriptIndex !== -1) {
        extension_settings.regex[existingScriptIndex] = regexScript;
    } else {
        extension_settings.regex.push(regexScript);
    }

    saveSettingsDebounced();
    await loadRegexScripts();

    // Reload the current chat to undo previous markdown
    const currentChatId = getCurrentChatId();
    if (currentChatId !== undefined && currentChatId !== null) {
        await reloadCurrentChat();
    }
}

async function deleteRegexScript({ existingId }) {
    let scriptName = $(`#${existingId}`).find(".regex_script_name").text();

    const existingScriptIndex = extension_settings.regex.findIndex((script) => script.scriptName === scriptName);
    if (!existingScriptIndex || existingScriptIndex !== -1) {
        extension_settings.regex.splice(existingScriptIndex, 1);

        saveSettingsDebounced();
        await loadRegexScripts();
    }
}

async function loadRegexScripts() {
    $("#saved_regex_scripts").empty();

    const scriptTemplate = $(await $.get("scripts/extensions/regex/scriptTemplate.html"));

    extension_settings.regex.forEach((script) => {
        // Have to clone here
        const scriptHtml = scriptTemplate.clone();
        scriptHtml.attr("id", uuidv4());
        scriptHtml.find(".regex_script_name").text(script.scriptName);
        scriptHtml.find(".edit_existing_regex").on("click", async function () {
            await onRegexEditorOpenClick(scriptHtml.attr("id"));
        });
        scriptHtml.find(".delete_regex").on("click", async function () {
            await deleteRegexScript({ existingId: scriptHtml.attr("id") });
        });

        $("#saved_regex_scripts").append(scriptHtml);
    });
}

async function onRegexEditorOpenClick(existingId) {
    const editorHtml = $(await $.get("scripts/extensions/regex/editor.html"));

    // If an ID exists, fill in all the values
    let existingScriptIndex = -1;
    if (existingId) {
        const existingScriptName = $(`#${existingId}`).find(".regex_script_name").text();
        existingScriptIndex = extension_settings.regex.findIndex((script) => script.scriptName === existingScriptName);
        if (existingScriptIndex !== -1) {
            const existingScript = extension_settings.regex[existingScriptIndex];
            if (existingScript.scriptName) {
                editorHtml.find(`.regex_script_name`).val(existingScript.scriptName);
            } else {
                toastr.error("This script doesn't have a name! Please delete it.");
                return;
            }

            editorHtml.find(`.find_regex`).val(existingScript.findRegex || "");
            editorHtml.find(`.regex_replace_string`).val(existingScript.replaceString || "");
            editorHtml.find(`.regex_trim_strings`).val(existingScript.trimStrings?.join("\n") || []);
            editorHtml.find(`input[name="disabled"]`).prop("checked", existingScript.disabled ?? false);
            editorHtml.find(`input[name="only_format_display"]`).prop("checked", existingScript.markdownOnly ?? false);
            editorHtml.find(`input[name="run_on_edit"]`).prop("checked", existingScript.runOnEdit ?? false);
            editorHtml.find(`input[name="substitute_regex"]`).prop("checked", existingScript.substituteRegex ?? false);
            editorHtml.find(`select[name="replace_strategy_select"]`).val(existingScript.replaceStrategy ?? 0);

            existingScript.placement.forEach((element) => {
                editorHtml.find(`input[name="replace_position"][value="${element}"]`).prop("checked", true);
            });
        }
    } else {
        editorHtml.find(`input[name="only_format_display"]`).prop("checked", true);

        editorHtml.find(`input[name="run_on_edit"]`).prop("checked", true);

        editorHtml.find(`input[name="replace_position"][value="1"]`).prop("checked", true);
    }

    const popupResult = await callPopup(editorHtml, "confirm", undefined, {
        okButton: "Save",
    });
    if (popupResult) {
        const newRegexScript = {
            scriptName: editorHtml.find(".regex_script_name").val(),
            findRegex: editorHtml.find(".find_regex").val(),
            replaceString: editorHtml.find(".regex_replace_string").val(),
            trimStrings:
                editorHtml
                    .find(".regex_trim_strings")
                    .val()
                    .split("\n")
                    .filter((e) => e.length !== 0) || [],
            placement:
                editorHtml
                    .find(`input[name="replace_position"]`)
                    .filter(":checked")
                    .map(function () {
                        return parseInt($(this).val());
                    })
                    .get()
                    .filter((e) => e !== NaN) || [],
            disabled: editorHtml.find(`input[name="disabled"]`).prop("checked"),
            markdownOnly: editorHtml.find(`input[name="only_format_display"]`).prop("checked"),
            runOnEdit: editorHtml.find(`input[name="run_on_edit"]`).prop("checked"),
            substituteRegex: editorHtml.find(`input[name="substitute_regex"]`).prop("checked"),
            replaceStrategy:
                parseInt(editorHtml.find(`select[name="replace_strategy_select"]`).find(`:selected`).val()) ?? 0,
        };

        saveRegexScript(newRegexScript, existingScriptIndex);
    }
}

// Common settings migration function. Some parts will eventually be removed
// TODO: Maybe migrate placement to strings?
function migrateSettings() {
    let performSave = false;

    // Current: If MD Display is present in placement, remove it and add new placements/MD option
    extension_settings.regex.forEach((script) => {
        if (script.placement.includes(regex_placement.MD_DISPLAY)) {
            script.placement =
                script.placement.length === 1
                    ? Object.values(regex_placement).filter((e) => e !== regex_placement.MD_DISPLAY)
                    : (script.placement = script.placement.filter((e) => e !== regex_placement.MD_DISPLAY));

            script.markdownOnly = true;

            performSave = true;
        }

        // Old system and sendas placement migration
        // 4 - sendAs
        if (script.placement.includes(4)) {
            script.placement =
                script.placement.length === 1
                    ? [regex_placement.SLASH_COMMAND]
                    : (script.placement = script.placement.filter((e) => e !== 4));

            performSave = true;
        }
    });

    if (performSave) {
        saveSettingsDebounced();
    }
}

// Workaround for loading in sequence with other extensions
// NOTE: Always puts extension at the top of the list, but this is fine since it's static
jQuery(async () => {
    if (extension_settings.regex) {
        migrateSettings();
    }

    // Manually disable the extension since static imports auto-import the JS file
    if (extension_settings.disabledExtensions.includes("regex")) {
        return;
    }

    const settingsHtml = await $.get("scripts/extensions/regex/dropdown.html");
    $("#extensions_settings2").append(settingsHtml);
    $("#open_regex_editor").on("click", function () {
        onRegexEditorOpenClick(false);
    });

    $("#saved_regex_scripts").sortable({
        stop: function () {
            let newScripts = [];
            $("#saved_regex_scripts")
                .children()
                .each(function () {
                    const scriptName = $(this).find(".regex_script_name").text();
                    const existingScript = extension_settings.regex.find((e) => e.scriptName === scriptName);
                    if (existingScript) {
                        newScripts.push(existingScript);
                    }
                });

            extension_settings.regex = newScripts;
            saveSettingsDebounced();

            console.debug("Regex scripts reordered");
            // TODO: Maybe reload regex scripts after move
        },
    });

    await loadRegexScripts();
    $("#saved_regex_scripts").sortable("enable");
});
