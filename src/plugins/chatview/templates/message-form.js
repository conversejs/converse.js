import { __ } from "i18n";
import { api, u } from "@converse/headless";
import { html } from "lit";
import { resetElementHeight } from "../utils.js";

/**
 * @param {import('../message-form').default} el
 */
export default (el) => {
    const composing_spoiler = el.model.get("composing_spoiler");
    const label_message = composing_spoiler ? __("Hidden message") : __("Message");
    const label_spoiler_hint = __("Optional hint");
    const message_limit = api.settings.get("message_limit");
    const show_call_button = api.settings.get("visible_toolbar_buttons").call;
    const show_emoji_button = api.settings.get("visible_toolbar_buttons").emoji;
    const show_send_button = api.settings.get("show_send_button");
    const show_spoiler_button = api.settings.get("visible_toolbar_buttons").spoiler;
    const show_toolbar = api.settings.get("show_toolbar");

    return html` <form
        class="chat-message-form"
        @submit="${/** @param {SubmitEvent} ev */ (ev) => el.onFormSubmitted(ev)}"
    >
        ${show_toolbar
            ? html` <converse-chat-toolbar
                  class="btn-toolbar chat-toolbar no-text-select"
                  .model=${el.model}
                  ?composing_spoiler="${composing_spoiler}"
                  ?show_call_button="${show_call_button}"
                  ?show_emoji_button="${show_emoji_button}"
                  ?show_send_button="${show_send_button}"
                  ?show_spoiler_button="${show_spoiler_button}"
                  ?show_toolbar="${show_toolbar}"
                  message_limit="${message_limit}"
              ></converse-chat-toolbar>`
            : ""}

        <input
            type="text"
            enterkeyhint="send"
            placeholder="${label_spoiler_hint || ""}"
            .value="${el.model.get("draft_hint") ?? ""}"
            @change="${
                /** @param {Event} ev */ (ev) =>
                    u.safeSave(el.model, { draft_hint: /** @type {HTMLInputElement} */ (ev.target).value })
            }"
            class="${composing_spoiler ? "" : "hidden"} spoiler-hint"
        />
        <textarea
            autofocus
            type="text"
            enterkeyhint="send"
            .value="${el.model.get("draft") ?? ""}"
            @drop="${/** @param {DragEvent} ev */ (ev) => el.onDrop(ev)}"
            @input="${resetElementHeight}"
            @keydown="${/** @param {KeyboardEvent} ev */ (ev) => el.onKeyDown(ev)}"
            @keyup="${/** @param {KeyboardEvent} ev */ (ev) => el.onKeyUp(ev)}"
            @paste="${/** @param {ClipboardEvent} ev */ (ev) => el.onPaste(ev)}"
            @change="${
                /** @param {Event} ev */ (ev) =>
                    u.safeSave(el.model, { draft: /** @type {HTMLTextAreaElement} */ (ev.target).value })
            }"
            class="chat-textarea
                        ${el.model.get("correcting") ? "correcting" : ""}
                        ${show_send_button ? "chat-textarea-send-button" : ""}
                        ${composing_spoiler ? "spoiler" : ""}"
            placeholder="${label_message}"
        ></textarea>
    </form>`;
};
