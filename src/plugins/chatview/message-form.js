/**
 * @typedef {import('shared/chat/emoji-dropdown.js').default} EmojiDropdown
 */
import { _converse, api, converse, constants, u } from "@converse/headless";
import { __ } from "i18n";
import { CustomElement } from "shared/components/element.js";
import tplMessageForm from "./templates/message-form.js";
import { parseMessageForCommands } from "./utils.js";

const { ACTIVE, COMPOSING } = constants;

export default class MessageForm extends CustomElement {
    static get properties() {
        return {
            model: { type: Object },
        };
    }

    constructor() {
        super();
        this.model = null;
    }

    async initialize() {
        await this.model.initialized;
        this.listenTo(this.model, "change:composing_spoiler", () => this.requestUpdate());
        this.listenTo(this.model, "change:draft", () => this.requestUpdate());
        this.listenTo(this.model, "change:hidden", () => {
            if (this.model.get("hidden")) {
                const draft_hint = /** @type {HTMLInputElement} */ (this.querySelector(".spoiler-hint"))?.value;
                const draft_message = /** @type {HTMLTextAreaElement} */ (this.querySelector(".chat-textarea"))?.value;
                u.safeSave(this.model, { draft: draft_message, draft_hint });
            }
        });

        this.handleEmojiSelection = (/** @type { CustomEvent } */ { detail }) => {
            if (this.model.get("jid") === detail.jid) {
                this.insertIntoTextArea(detail.value, detail.autocompleting, detail.ac_position);
            }
        };
        document.addEventListener("emojiSelected", this.handleEmojiSelection);
        this.requestUpdate();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener("emojiSelected", this.handleEmojiSelection);
    }

    render() {
        return tplMessageForm(this);
    }

    /**
     * Insert a particular string value into the textarea of this chat box.
     * @param {string} value - The value to be inserted.
     * @param {(boolean|string)} [replace] - Whether an existing value
     *  should be replaced. If set to `true`, the entire textarea will
     *  be replaced with the new value. If set to a string, then only
     *  that string will be replaced *if* a position is also specified.
     * @param {number} [position] - The end index of the string to be
     *  replaced with the new value.
     */
    insertIntoTextArea(value, replace = false, position, separator = " ") {
        const textarea = /** @type {HTMLTextAreaElement} */ (this.querySelector(".chat-textarea"));
        if (replace) {
            if (position && typeof replace == "string") {
                textarea.value = textarea.value.replace(new RegExp(replace, "g"), (match, offset) =>
                    offset == position - replace.length ? value + separator : match
                );
            } else {
                textarea.value = value;
            }
        } else {
            let existing = textarea.value;
            if (existing && existing[existing.length - 1] !== separator) {
                existing = existing + separator;
            }
            textarea.value = existing + value + separator;
        }
        const ev = new Event("change", { bubbles: false, cancelable: true });
        textarea.dispatchEvent(ev);
        u.placeCaretAtEnd(textarea);
    }

    /**
     * Handles the escape key press event to stop correcting a message.
     * @param {KeyboardEvent} ev
     */
    onEscapePressed(ev) {
        const idx = this.model.messages.findLastIndex("correcting");
        const message = idx >= 0 ? this.model.messages.at(idx) : null;
        if (message) {
            ev.preventDefault();
            message.save("correcting", false);
        }
    }

    /**
     * Handles the paste event to insert text or files into the chat.
     * @param {ClipboardEvent} ev
     */
    onPaste(ev) {
        ev.stopPropagation();
        if (ev.clipboardData.files.length !== 0) {
            ev.preventDefault();
            this.model.sendFiles(Array.from(ev.clipboardData.files));
            return;
        }
        this.model.save({ draft: ev.clipboardData.getData("text/plain") });
    }

    /**
     * Handles the drop event to send files dragged-and-dropped into the chat.
     * @param {DragEvent} ev
     */
    onDrop(ev) {
        if (ev.dataTransfer.files.length == 0) {
            return;
        }
        ev.preventDefault();
        this.model.sendFiles(ev.dataTransfer.files);
    }

    /**
     * @param {KeyboardEvent} ev
     */
    onKeyUp(ev) {
        // Trigger an event, for `<converse-message-limit-indicator/>`
        this.model.trigger('event:keyup', { ev });
    }

    /**
     * @param {KeyboardEvent} [ev]
     */
    onKeyDown(ev) {
        if (ev.ctrlKey) {
            // When ctrl is pressed, no chars are entered into the textarea.
            return;
        }
        if (!ev.shiftKey && !ev.altKey && !ev.metaKey) {
            const target = /** @type {HTMLInputElement|HTMLTextAreaElement} */ (ev.target);

            if (ev.key === converse.keycodes.TAB) {
                const value = u.getCurrentWord(target, null, /(:.*?:)/g);
                if (value.startsWith(":")) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    this.model.trigger("emoji-picker-autocomplete", { target, value });
                }
            } else if (ev.key === converse.keycodes.FORWARD_SLASH) {
                // Forward slash is used to run commands. Nothing to do here.
                return;
            } else if (ev.key === converse.keycodes.ESCAPE) {
                return this.onEscapePressed(ev);
            } else if (ev.key === converse.keycodes.ENTER) {
                return this.onFormSubmitted(ev);
            } else if (ev.key === converse.keycodes.UP_ARROW && !target.selectionEnd) {
                const textarea = /** @type {HTMLTextAreaElement} */ (this.querySelector(".chat-textarea"));
                if (!textarea.value || this.model.get('correcting')) {
                    return this.model.editEarlierMessage();
                }
            } else if (
                ev.key === converse.keycodes.DOWN_ARROW &&
                target.selectionEnd === target.value.length &&
                this.model.get('correcting')
            ) {
                return this.model.editLaterMessage();
            }
        }
        if (
            [converse.keycodes.SHIFT, converse.keycodes.META, converse.keycodes.ESCAPE, converse.keycodes.ALT].includes(
                ev.key
            )
        ) {
            return;
        }
        if (this.model.get("chat_state") !== COMPOSING) {
            // Set chat state to composing if key is not a forward-slash
            // (which would imply an internal command and not a message).
            this.model.setChatState(COMPOSING);
        }
    }

    /**
     * @param {SubmitEvent|KeyboardEvent} ev
     */
    async onFormSubmitted(ev) {
        ev?.preventDefault?.();
        const { chatboxviews } = _converse.state;
        const textarea = /** @type {HTMLTextAreaElement} */ (this.querySelector(".chat-textarea"));
        const message_text = textarea.value.trim();
        if (
            (api.settings.get("message_limit") && message_text.length > api.settings.get("message_limit")) ||
            !message_text.replace(/\s/g, "").length
        ) {
            return;
        }
        if (!api.connection.get().authenticated) {
            const err_msg = __("Sorry, the connection has been lost, and your message could not be sent");
            api.alert("error", __("Error"), err_msg);
            api.connection.reconnect();
            return;
        }
        let spoiler_hint,
            hint_el = {};
        if (this.model.get("composing_spoiler")) {
            hint_el = /** @type {HTMLInputElement} */ (this.querySelector("form.chat-message-form input.spoiler-hint"));
            spoiler_hint = hint_el.value;
        }
        u.addClass("disabled", textarea);
        textarea.setAttribute("disabled", "disabled");
        /** @type {EmojiDropdown} */ (this.querySelector("converse-emoji-dropdown"))?.dropdown.hide();

        const is_command = await parseMessageForCommands(this.model, message_text);
        const message = is_command ? null : await this.model.sendMessage({ "body": message_text, spoiler_hint });
        if (is_command || message) {
            hint_el.value = "";
            textarea.value = "";
            textarea.style.height = "auto";
            this.model.set({ "draft": "" });
        }
        if (api.settings.get("view_mode") === "overlayed") {
            // XXX: Chrome flexbug workaround. The .chat-content area
            // doesn't resize when the textarea is resized to its original size.
            const chatview = chatboxviews.get(this.model.get("jid"));
            const msgs_container = chatview.querySelector(".chat-content__messages");
            msgs_container.parentElement.style.display = "none";
        }
        textarea.removeAttribute("disabled");
        u.removeClass("disabled", textarea);

        if (api.settings.get("view_mode") === "overlayed") {
            // XXX: Chrome flexbug workaround.
            const chatview = chatboxviews.get(this.model.get("jid"));
            const msgs_container = chatview.querySelector(".chat-content__messages");
            msgs_container.parentElement.style.display = "";
        }
        // Suppress events, otherwise superfluous CSN gets set
        // immediately after the message, causing rate-limiting issues.
        this.model.setChatState(ACTIVE, { "silent": true });
        textarea.focus();
    }
}

api.elements.define("converse-message-form", MessageForm);
