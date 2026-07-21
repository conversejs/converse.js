/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * The rich (Lexical) chat composer, used for one-to-one chats. MUC still renders its own
 * textarea-based form, so {@link MessageForm} remains the base for both.
 *
 * Everything downstream of the composer stays untouched, because its only contract with
 * headless is the message body: a plain-text string carrying XEP-0393 styling markers,
 * exactly what a textarea user could have typed. Commands, XEP-0372 references, OMEMO and
 * corrections all keep operating on that string.
 */
import { api, constants, converse, u } from '@converse/headless';
import MessageForm from './message-form.js';
import tplMessageFormRich from './templates/message-form-rich.js';

import './styles/message-form-rich.scss';
import 'shared/rich-composer/styles/typeahead.scss';

const { COMPOSING } = constants;

export default class MessageFormRich extends MessageForm {
    static get properties() {
        return {
            model: { type: Object },
            is_empty: { type: Boolean, state: true },
        };
    }

    constructor() {
        super();
        this.is_empty = true;
        /** @type {import('shared/rich-composer/types').RichEditor|null} */
        this._handle = null;
        /** @type {Promise<import('shared/rich-composer/types').RichEditor>|null} */
        this._init = null;
    }

    async initialize() {
        await super.initialize();
        // `draft` is not just our own scratch space: starting a correction stores the
        // message being edited there (see ModelWithMessages), and the plain composer picks
        // that up because its template renders `.value` from it. An attached editor has to
        // be told.
        this.listenTo(this.model, 'change:draft', () => this.onDraftChanged());
    }

    render() {
        return tplMessageFormRich(this);
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
        // eagerly in that case. Otherwise stay lazy and keep Lexical out of the way.
        //
        // Checked on every render rather than just the first: hiding a chat disconnects the
        // element and tears the editor down, and on the way back only a re-render tells us
        // to put it up again.
        if (!this._init && this.model?.get('draft')) this.ensureEditor();
    }

    disconnectedCallback() {
        this._handle?.destroy();
        this._handle = null;
        this._init = null;
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
        disabled ? u.addClass('disabled', host) : u.removeClass('disabled', host);
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
}

api.elements.define('converse-message-form-rich', MessageFormRich);
