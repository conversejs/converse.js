/**
 * @typedef {import('shared/chat/emoji-dropdown.js').default} EmojiDropdown
 */
/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * The chat composer, based on the Lexical rich-text editor.
 *
 * Lexical itself is loaded on first focus (see {@link ensureEditor}), so it stays out of
 * the core bundle.
 */
import { _converse, api, constants, converse, u } from '@converse/headless';
import { __ } from 'i18n';
import { CustomElement } from 'shared/components/element.js';
import tplMessageForm from './templates/message-form.js';
import { parseMessageForCommands } from './utils.js';
import { TypeaheadController } from 'shared/rich-composer/typeahead.js';
import { EMOJI_SOURCE } from 'shared/rich-composer/emoji-source.js';

import './styles/message-form.scss';
import 'shared/rich-composer/styles/typeahead.scss';

const { ACTIVE, COMPOSING } = constants;

export default class MessageForm extends CustomElement {
    static get properties() {
        return {
            model: { type: Object },
            is_empty: { type: Boolean, state: true },
        };
    }

    constructor() {
        super();
        this.model = null;
        this.shiftDown = false;
        this.is_empty = true;

        /** @type {import('shared/rich-composer/types').RichEditor|null} */
        this._handle = null;

        /** @type {Promise<import('shared/rich-composer/types').RichEditor>|null} */
        this._init = null;

        this.typeahead = new TypeaheadController(this, {
            sources: this.getTypeaheadSources(),
            getHandle: () => this._handle,
            container: '.chat-rich',
            editable: '.chat-rich__editable',
        });
    }

    /**
     * The caret-typeahead sources this composer offers, most specific first (the first
     * whose trigger the caret sits on wins, so triggers must be mutually exclusive).
     * @returns {import('shared/rich-composer/types').TypeaheadSource[]}
     */
    getTypeaheadSources() {
        return [EMOJI_SOURCE];
    }

    async initialize() {
        await this.model.initialized;
        this.listenTo(this.model, 'change:composing_spoiler', () => this.requestUpdate());
        this.listenTo(this.model, 'change:draft', () => {
            this.onDraftChanged();
            this.requestUpdate();
        });
        this.listenTo(this.model, 'change:hidden', () => {
            if (this.model.get('hidden')) {
                const draft_hint = /** @type {HTMLInputElement} */ (this.querySelector('.spoiler-hint'))?.value;
                u.safeSave(this.model, { draft: this.getInputText(), draft_hint });
            }
        });

        this.handleEmojiSelection = (/** @type {CustomEvent} */ { detail }) => {
            if (this.model.get('jid') === detail.jid) {
                this.insertIntoTextArea(detail.value);
            }
        };
        document.addEventListener('emojiSelected', this.handleEmojiSelection);
        this.requestUpdate();
    }

    render() {
        return tplMessageForm(this);
    }

    /** Load an externally-set draft into the editor, ignoring the ones we wrote ourselves. */
    async onDraftChanged() {
        const draft = this.model.get('draft') ?? '';
        if (!this._handle) {
            if (draft) await this.ensureEditor();
            return;
        }
        if (draft === this.getInputText()) return;

        this._handle.setMarkdown(draft);
        this.onChange();
    }

    updated() {
        // A draft (text left behind when the chat was hidden, or a quoted message inserted
        // by the quote action) has to be visible without the user focusing first, so attach
        // eagerly if there is one. Otherwise stay lazy and keep Lexical out of the way.
        //
        // Checked on every render rather than just the first. Hiding a chat disconnects the
        // element and tears the editor down, and on the way back only a re-render tells us
        // to put it up again.
        if (!this._init && this.model?.get('draft')) this.ensureEditor();
    }

    disconnectedCallback() {
        this._handle?.destroy();
        this._handle = null;
        this._init = null;
        document.removeEventListener('emojiSelected', this.handleEmojiSelection);
        super.disconnectedCallback();
    }

    /**
     * Load Lexical and attach it to the contenteditable host, once. The dynamic import
     * keeps the editor out of the core bundle.
     * @returns {Promise<import('shared/rich-composer/types').RichEditor>}
     */
    ensureEditor() {
        if (this._init) return this._init;

        const host = /** @type {HTMLElement} */ (this.querySelector('.chat-rich__editable'));

        this._init = import('./lexical-editor.js').then((m) => {
            const handle = m.createChatEditor(host, { onChange: () => this.onChange() });
            this._handle = handle;
            const draft = this.model?.get('draft');
            if (draft) handle.setMarkdown(draft);

            this.onChange();
            return handle;
        });

        return this._init;
    }

    /** Reflect emptiness so the placeholder shows only when there is nothing to send. */
    onChange() {
        const empty = this._handle?.isEmpty() ?? true;
        if (empty !== this.is_empty) this.is_empty = empty;

        // Keep the character counter honest on every edit, not just on keyup: text can
        // arrive from the emoji picker or a quote without a key ever being pressed.
        this.model?.trigger('event:keyup', { text: this.rawText() });
        this.typeahead.update();
    }

    /**
     * @param {FocusEvent} [ev]
     */
    onEditorFocusOut(ev) {
        this.typeahead.onFocusOut(ev);
    }

    /** The composer's text, untrimmed, which is what the character counter measures. */
    rawText() {
        return this._handle?.getMarkdown() ?? '';
    }

    /** @returns {string} The document serialized to an XEP-0393 styled body. */
    getInputText() {
        return (this._handle?.getMarkdown() ?? '').trim();
    }

    clearInput() {
        this._handle?.clear();
        this.is_empty = true;
    }

    /** @param {boolean} disabled */
    setInputDisabled(disabled) {
        const host = /** @type {HTMLElement} */ (this.querySelector('.chat-rich__editable'));
        if (!host) return;

        host.setAttribute('contenteditable', disabled ? 'false' : 'true');
        if (disabled) {
            u.addClass('disabled', host);
        } else {
            u.removeClass('disabled', host);
        }
    }

    focusInput() {
        if (this._handle) this._handle.focus();
        else /** @type {HTMLElement} */ (this.querySelector('.chat-rich__editable'))?.focus();
    }

    /**
     * Insert text at the caret. Overrides the textarea implementation, which the emoji
     * dropdown drives through the `emojiSelected` event.
     * @param {string} value
     */
    async insertIntoTextArea(value) {
        const handle = await this.ensureEditor();

        // Space it off the preceding word and leave one after, as the textarea did, so
        // typing can carry straight on after the emoji.
        const existing = this.rawText();
        const prefix = existing && !existing.endsWith(' ') ? ' ' : '';
        handle.insertText(`${prefix}${value} `);
        handle.focus();
    }

    /**
     * Insert `text` at the caret, then mirror the result into the draft.
     *
     * The textarea version writes to `draft` and lets the template render it back, which
     * an attached editor would never see, so the insert has to go through the editor.
     * @param {string} text
     */
    async insertAtCaret(text) {
        const handle = await this.ensureEditor();

        // Parsed rather than inserted literally, so a quote becomes a real blockquote
        // instead of a line that merely starts with '>'. It serializes back the same way.
        const current = this.getInputText();
        handle.setMarkdown(current ? `${current}\n${text}` : text);
        this.onChange();
        this.model.save({ draft: this.getInputText() });
        handle.focus();
    }

    /**
     * Mirrors the base handler, but hands the character counter the composer's text: it
     * would otherwise read `.value` off the event target, which a contenteditable lacks.
     * @param {KeyboardEvent} ev
     */
    onKeyUp(ev) {
        if (ev.key === converse.keycodes.SHIFT) this.shiftDown = false;

        this.model.trigger('event:keyup', { ev, text: this.rawText() });
    }

    /**
     * @param {KeyboardEvent} ev
     */
    onKeyDown(ev) {
        // The menu owns arrows / Enter / Tab / Escape while it is open, so they reach
        // neither Lexical nor the send-and-correct handling below.
        if (this.typeahead.onKeyDown(ev)) return;

        const { keycodes } = converse;
        if (ev.key === keycodes.SHIFT) this.shiftDown = true;

        if (
            ev.ctrlKey ||
            (ev.shiftKey && ev.key === keycodes.ENTER) ||
            [keycodes.SHIFT, keycodes.META, keycodes.ALT].includes(ev.key)
        ) {
            return;
        }

        if (!ev.shiftKey && !ev.altKey && !ev.metaKey) {
            if (ev.key === keycodes.FORWARD_SLASH) {
                // Forward slash runs a command; nothing to do here.
                return;
            } else if (ev.key === keycodes.ESCAPE) {
                return this.onEscapePressed(ev);
            } else if (ev.key === keycodes.ENTER) {
                // Lexical would otherwise insert a paragraph break.
                ev.preventDefault();
                return this.onFormSubmitted(ev);
            } else if (ev.key === keycodes.UP_ARROW && this._handle?.isCaretAtStart()) {
                if (this.is_empty || this.model.get('correcting')) {
                    ev.preventDefault();
                    return this.model.editEarlierMessage();
                }
            } else if (ev.key === keycodes.DOWN_ARROW && this._handle?.isCaretAtEnd() && this.model.get('correcting')) {
                ev.preventDefault();
                return this.model.editLaterMessage();
            }
        }

        if (this.model.get('chat_state') !== COMPOSING) {
            this.model.setChatState(COMPOSING);
        }
    }

    /**
     * Handles the escape key press event to stop correcting a message.
     * @param {KeyboardEvent} ev
     */
    onEscapePressed(ev) {
        const idx = this.model.messages.findLastIndex('correcting');
        const message = idx >= 0 ? this.model.messages.at(idx) : null;
        if (message) {
            ev.preventDefault();
            message.save('correcting', false);
        }
    }

    /**
     * Handles the paste event to insert text or files into the chat.
     * @param {ClipboardEvent} ev
     */
    onPaste(ev) {
        if (this.shiftDown) return;

        if (ev.clipboardData.files.length !== 0) {
            ev.stopPropagation();
            ev.preventDefault();
            this.model.sendFiles(Array.from(ev.clipboardData.files));
        }
    }

    /**
     * Handles the drop event to send files dragged-and-dropped into the chat.
     * @param {DragEvent} ev
     */
    onDrop(ev) {
        if (ev.dataTransfer.files.length == 0) return;

        ev.preventDefault();
        this.model.sendFiles(ev.dataTransfer.files);
    }

    /**
     * @param {SubmitEvent|KeyboardEvent} ev
     */
    async onFormSubmitted(ev) {
        ev?.preventDefault?.();
        const { chatboxviews } = _converse.state;
        const message_text = this.getInputText();
        if (
            (api.settings.get('message_limit') && message_text.length > api.settings.get('message_limit')) ||
            !message_text.replace(/\s/g, '').length
        ) {
            return;
        }

        if (!api.connection.get().authenticated) {
            const err_msg = __('Sorry, the connection has been lost, and your message could not be sent');
            api.alert('error', __('Error'), err_msg);
            api.connection.reconnect();
            return;
        }

        let spoiler_hint,
            hint_el = {};
        if (this.model.get('composing_spoiler')) {
            hint_el = /** @type {HTMLInputElement} */ (this.querySelector('form.chat-message-form input.spoiler-hint'));
            spoiler_hint = hint_el.value;
        }
        this.setInputDisabled(true);
        /** @type {EmojiDropdown} */ (this.querySelector('converse-emoji-dropdown'))?.hide();

        const is_command = await parseMessageForCommands(this.model, message_text);
        const message = is_command ? null : await this.model.sendMessage({ 'body': message_text, spoiler_hint });
        if (is_command || message) {
            hint_el.value = '';
            this.clearInput();
            this.model.save({ 'draft': '' });
        }

        if (api.settings.get('view_mode') === 'overlayed') {
            // XXX: Chrome flexbug workaround. The .chat-content area
            // doesn't resize when the composer is resized to its original size.
            const chatview = chatboxviews.get(this.model.get('jid'));
            const msgs_container = chatview.querySelector('.chat-content__messages');
            msgs_container.parentElement.style.display = 'none';
        }
        this.setInputDisabled(false);

        if (api.settings.get('view_mode') === 'overlayed') {
            // XXX: Chrome flexbug workaround.
            const chatview = chatboxviews.get(this.model.get('jid'));
            const msgs_container = chatview.querySelector('.chat-content__messages');
            msgs_container.parentElement.style.display = '';
        }

        // Suppress events, otherwise superfluous CSN gets set
        // immediately after the message, causing rate-limiting issues.
        this.model.setChatState(ACTIVE, { 'silent': true });
        this.focusInput();
    }
}

api.elements.define('converse-message-form', MessageForm);
