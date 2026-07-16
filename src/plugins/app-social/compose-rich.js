/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * A rich-text composer built on Lexical.
 *
 * Lexical is loaded via a dynamic `import()` on first focus (see {@link ./lexical-editor.js}),
 * so it never weighs down the core bundle.
 *
 * On submit the post is published as dual content:
 * Markdown (`<content type="text">`) plus rendered XHTML (`<content type="xhtml">`).
 */
import { api, converse, log, uploadFile, PubSubFeed } from '@converse/headless';
import DOMPurify from 'dompurify';
import { CustomElement } from 'shared/components/element.js';
import { shortnamesToEmojis } from 'shared/chat/utils.js';
import { __ } from 'i18n';
import tplComposeRich from './templates/compose-rich.js';
import './emoji-dropdown.js';

import './styles/compose-rich.scss';

const NS_XHTML = 'http://www.w3.org/1999/xhtml';

const MAX_EMOJI_SUGGESTIONS = 8; // Caps inline emoji-autocomplete list

export default class SocialComposeRich extends CustomElement {
    static get properties() {
        return {
            model: { type: PubSubFeed },
            _publishing: { type: Boolean, state: true },
            _uploading: { type: Boolean, state: true },
            _empty: { type: Boolean, state: true },
            _attachments: { type: Array, state: true },
            _emoji_suggestions: { type: Array, state: true },
            _emoji_index: { type: Number, state: true },
            _emoji_pos: { type: Object, state: true },
        };
    }

    constructor() {
        super();
        this._publishing = false;
        this._uploading = false;
        this._empty = true;

        // Pending media attachments (XEP-0363-uploaded), published as enclosures.
        /** @type {Array<{ href: string, type?: string, title?: string }>} */
        this._attachments = [];

        // The Lexical editor handle, created lazily on first focus (see ensureEditor).
        /** @type {import('./types').EditorHandle|null} */
        this._handle = null;

        /** @type {Promise<import('./types').EditorHandle>|null} */
        this._init = null;

        // Inline emoji-shortname autocomplete
        /** @type {Array<{ sn: string, glyph: string, url?: string }>} */
        this._emoji_suggestions = [];
        this._emoji_index = 0;

        /** @type {{ left: number, top: number }} */
        this._emoji_pos = { left: 0, top: 0 };

        // The query the current suggestions were built for
        this._emoji_query = '';

        // The query the user dismissed with Escape; the menu stays closed for it until
        // the query changes
        /** @type {string|null} */
        this._emoji_dismissed_query = null;

        // Set (for the current event dispatch only) when a blur closed an open menu,
        // so an Escape keydown arriving in the same dispatch can tell the menu was
        // open for it (see onEditorFocusOut / onEditorKeyDown).
        this._menu_closed_by_blur = false;

        // Whether a pointer recently went down anywhere in the document (see
        // connectedCallback / onEditorFocusOut).
        this._pointer_down = false;
    }

    render() {
        return tplComposeRich(this);
    }

    connectedCallback() {
        super.connectedCallback();

        // Track (briefly) that a pointer went down anywhere, so a menu-closing blur
        // can tell a mouse click apart from a keyboard-initiated blur (see
        // onEditorFocusOut). Capture phase, so no handler can swallow it first.
        this._onDocPointerDown = () => {
            this._pointer_down = true;
            clearTimeout(this._pointer_down_timer);
            this._pointer_down_timer = setTimeout(() => (this._pointer_down = false), 400);
        };
        document.addEventListener('pointerdown', this._onDocPointerDown, { capture: true });
    }

    disconnectedCallback() {
        document.removeEventListener('pointerdown', this._onDocPointerDown, { capture: true });
        clearTimeout(this._pointer_down_timer);
        this._handle?.destroy();
        this._handle = null;
        this._init = null;
        super.disconnectedCallback();
    }

    /**
     * Lazily load Lexical and attach it to the contenteditable host, once. The
     * dynamic import keeps the (sizeable) editor out of the core bundle: the chunk
     * is fetched only when the user first focuses the composer.
     * @returns {Promise<import('./types').EditorHandle>}
     */
    ensureEditor() {
        if (this._init) return this._init;

        api.emojis.initialize();
        const host = /** @type {HTMLElement} */ (this.querySelector('.social-rich__editable'));
        this._init = import('./lexical-editor.js').then((m) => {
            const handle = m.createSocialEditor(host, { onChange: () => this.onChange() });
            this._handle = handle;
            handle.focus();
            return handle;
        });
        return this._init;
    }

    /** Reflect emptiness (placeholder + Post enabled) only when it actually flips. */
    onChange() {
        const empty = this._handle?.isEmpty() ?? true;
        if (empty !== this._empty) this._empty = empty;
        this.updateEmojiTypeahead();
    }

    /**
     * Recompute the inline emoji autocomplete after each edit: if the caret sits on
     * a `:query` trigger, show the matching shortnames; otherwise close the menu.
     */
    async updateEmojiTypeahead() {
        const query = this._handle?.getEmojiQuery() ?? null;
        if (!query) {
            // The caret left every trigger, so forget any earlier Escape dismissal.
            this._emoji_dismissed_query = null;
            return this.closeEmojiTypeahead();
        }

        // Honour an Escape dismissal: stay closed until the query actually changes.
        if (query === this._emoji_dismissed_query) return this.closeEmojiTypeahead();
        this._emoji_dismissed_query = null;

        await api.emojis.initialize();

        // The caret may have moved, or the menu been dismissed, while emojis loaded.
        if (this._handle?.getEmojiQuery() !== query || this._emoji_dismissed_query === query) return;

        // Only open while the user is actually typing in the editor. Lexical keeps
        // its selection (and so the trigger query) across a blur, so without this a
        // pending update could re-open the menu after focus has moved elsewhere.
        const host = /** @type {HTMLElement} */ (this.querySelector('.social-rich__editable'));
        if (host && host !== document.activeElement && !host.contains(document.activeElement)) {
            return this.closeEmojiTypeahead();
        }

        const q = query.toLowerCase();
        const ranked = [];
        for (const emoji of /** @type {any[]} */ (converse.emojis.list)) {
            const idx = emoji.sn.slice(1, -1).indexOf(q); // strip the wrapping colons
            if (idx !== -1) ranked.push({ emoji, idx });
        }
        // Prefix matches (idx 0) before substring matches, then alphabetical.
        ranked.sort((a, b) => a.idx - b.idx || (a.emoji.sn < b.emoji.sn ? -1 : 1));

        const suggestions = ranked.slice(0, MAX_EMOJI_SUGGESTIONS).map(({ emoji }) => ({
            sn: emoji.sn,
            url: emoji.url,
            glyph: shortnamesToEmojis(emoji.sn, { unicode_only: true, add_title_wrapper: false }).join(''),
        }));

        if (!suggestions.length) return this.closeEmojiTypeahead();

        this._emoji_query = query;
        this._emoji_suggestions = suggestions;
        this._emoji_index = 0;
        this._emoji_pos = this.caretPosition();
    }

    /** Close the emoji autocomplete menu. */
    closeEmojiTypeahead() {
        if (this._emoji_suggestions.length) this._emoji_suggestions = [];
    }

    /** The emoji menu's inline position, as a single CSS declaration string. */
    get emojiMenuStyle() {
        return `left: ${this._emoji_pos.left}px; top: ${this._emoji_pos.top}px`;
    }

    /**
     * The caret's position relative to the `.social-rich` container, so the menu can
     * be anchored just below the current line. Falls back to the editable's box when
     * a caret rect is unavailable.
     * @returns {{ left: number, top: number }}
     */
    caretPosition() {
        const container = this.querySelector('.social-rich');
        if (!container) return { left: 0, top: 0 };

        const base = container.getBoundingClientRect();
        const sel = window.getSelection();

        let rect = null;
        if (sel && sel.rangeCount) {
            const range = sel.getRangeAt(0).cloneRange();
            range.collapse(true);
            rect = range.getBoundingClientRect();
        }
        if (!rect || (!rect.width && !rect.height && !rect.left && !rect.top)) {
            rect = this.querySelector('.social-rich__editable')?.getBoundingClientRect() ?? base;
        }
        return { left: rect.left - base.left, top: rect.bottom - base.top };
    }

    /**
     * Keyboard navigation for the emoji menu. Intercepts arrows / Enter / Tab / Escape
     * only while the menu is open, keeping them away from Lexical (which handles the
     * same keys on the same element).
     * @param {KeyboardEvent} ev
     */
    onEditorKeyDown(ev) {
        if (!this._emoji_suggestions.length) {
            if (ev.key === 'Escape' && this._menu_closed_by_blur) {
                // This Escape's own blur (an extension blurring the editor before
                // we ran) already closed the menu: finish the dismissal by
                // reclaiming focus, and consume the event so the editor's own
                // blur-on-Escape doesn't immediately re-blur. A bare Escape (no
                // menu involved) falls through instead, and blurs. That is the
                // keyboard user's escape hatch out of the editor.
                this._menu_closed_by_blur = false;
                this._emoji_dismissed_query = this._emoji_query;
                ev.preventDefault();
                ev.stopImmediatePropagation();
                this._handle?.focus();
            }
            return;
        }

        switch (ev.key) {
            case 'ArrowDown':
                this.moveEmojiSelection(1);
                break;
            case 'ArrowUp':
                this.moveEmojiSelection(-1);
                break;
            case 'Enter':
            case 'Tab':
                this.chooseEmoji(this._emoji_index);
                break;
            case 'Escape':
                // Remember the dismissal so a later editor update can't re-open it,
                // and put focus back in the editor with the caret where it was.
                this._emoji_dismissed_query = this._emoji_query;
                this.closeEmojiTypeahead();
                this._handle?.focus();
                break;
            default:
                return;
        }
        ev.preventDefault();
        // Stop Lexical's own keydown handler (registered on the same element) too.
        ev.stopImmediatePropagation();
    }

    /**
     * Close the emoji menu whenever focus leaves the editor.
     * @param {FocusEvent} [ev]
     */
    onEditorFocusOut(ev) {
        const had_menu = this._emoji_suggestions.length > 0;
        if (had_menu) {
            // Remember, only until the current event dispatch has run its course,
            // that a blur (not a pick or dismissal) closed the menu. If this blur
            // was itself caused by an Escape press (a vim-style browser extension
            // blurring the focused element at document level, before our keydown
            // handler gets to run), the keydown handler must still treat that
            // Escape as "dismiss the menu" and reclaim focus.
            this._menu_closed_by_blur = true;
            setTimeout(() => (this._menu_closed_by_blur = false));
        }

        this.closeEmojiTypeahead();

        // Vimium (and kin) can swallow the Escape keydown entirely, so the page
        // never sees the key. This blur is the only signal. A keyboard-initiated
        // blur to nowhere while the menu was open can only be such a dismissal,
        // so reclaim focus for the editor. A pointer-initiated blur (a click
        // elsewhere), a focus move to a real element, or the window itself losing
        // focus must all genuinely take focus away instead.
        if (had_menu && !ev?.relatedTarget && !this._pointer_down) {
            const query = this._emoji_query;
            setTimeout(() => {
                if (document.hasFocus() && document.activeElement === document.body) {
                    this._emoji_dismissed_query = query;
                    this._handle?.focus();
                }
            });
        }
    }

    /**
     * Move the active suggestion, wrapping around the ends.
     * @param {number} delta
     */
    moveEmojiSelection(delta) {
        const n = this._emoji_suggestions.length;
        if (n) this._emoji_index = (this._emoji_index + delta + n) % n;
    }

    /**
     * The emoji picker dropdown was closed (Escape, outside click, or a pick):
     * hand focus back to the editor, with the caret where it was. Mirrors chat,
     * where the message textarea is refocused when the picker closes.
     */
    onPickerClosed() {
        this._handle?.focus();
    }

    /**
     * Insert the chosen suggestion's glyph in place of the `:query` trigger.
     * @param {number} index
     */
    chooseEmoji(index) {
        const choice = this._emoji_suggestions[index];
        if (!choice) return;
        this._handle?.replaceEmojiTrigger(this._emoji_query, choice.glyph);
        this.closeEmojiTypeahead();
        this._handle?.focus();
    }

    /**
     * @param {import('lexical').TextFormatType} type - the toolbar uses
     *      'bold' | 'italic' | 'strikethrough' | 'code'
     */
    async onFormat(type) {
        await this.ensureEditor();
        this._handle?.format(type);
    }

    /**
     * Insert a picked emoji (already resolved to a unicode glyph / text) at the cursor.
     * @param {string} text
     */
    async onEmoji(text) {
        if (!text) return;
        await this.ensureEditor();
        this._handle?.insertText(text);
        this._handle?.focus();
    }

    /**
     * Upload the chosen file(s) via XEP-0363 and add each as a pending attachment,
     * published later as a media enclosure. Failures are toasted per file.
     * @param {FileList|File[]} files
     */
    async onAttach(files) {
        const list = Array.from(files || []);
        if (!list.length) return;

        this._uploading = true;
        try {
            for (const file of list) {
                try {
                    const { url, type, name } = await uploadFile(file);
                    this._attachments = [...this._attachments, { href: url, type, title: name }];
                } catch (e) {
                    log.error(e);
                    api.toast?.show?.('social-upload-failed', {
                        type: 'danger',
                        body: __('Sorry, could not upload “%1$s”', file.name),
                    });
                }
            }
        } finally {
            this._uploading = false;
        }
    }

    /**
     * Drop a pending attachment before publishing.
     * @param {number} index
     */
    removeAttachment(index) {
        this._attachments = this._attachments.filter((_, i) => i !== index);
    }

    /**
     * Paste files (e.g. a screenshot) straight into the upload flow, exactly like a
     * paperclip pick. A text/rich paste carries no files, so it falls through to
     * Lexical unchanged.
     * @param {ClipboardEvent} ev
     */
    onPaste(ev) {
        const files = ev.clipboardData?.files;
        if (!files?.length) return;
        ev.preventDefault();
        // Stop Lexical's own paste handler (registered on the same element) from also
        // acting on the event.
        ev.stopImmediatePropagation();
        this.onAttach(files);
    }

    /**
     * Normalise Lexical's HTML export to a well-formed XHTML `<div>` fragment: run
     * it through DOMPurify (stripping the editor-only `class`/`style` hooks Lexical
     * stamps on for styling, so they never reach the wire), then re-serialize via
     * XMLSerializer so the result is valid XML (self-closed voids, escaped entities,
     * namespaced) and can be injected verbatim into the publish stanza (which is
     * XML-parsed).
     * @param {string} html
     * @returns {string}
     */
    htmlToXhtml(html) {
        const clean = DOMPurify.sanitize(html, {
            USE_PROFILES: { html: true },
            FORBID_ATTR: ['class', 'style'],
        });
        const parsed = new DOMParser().parseFromString(clean, 'text/html');
        const div = document.createElementNS(NS_XHTML, 'div');
        while (parsed.body.firstChild) div.appendChild(parsed.body.firstChild);
        return new XMLSerializer().serializeToString(div);
    }

    /**
     * @param {Event} [ev]
     */
    async onSubmit(ev) {
        ev?.preventDefault?.();
        const has_text = !!this._handle && !this._handle.isEmpty();
        // Postable with text, an attachment, or both; never while an upload is in flight.
        if (this._publishing || this._uploading || (!has_text && !this._attachments.length)) return;

        this._publishing = true;
        try {
            const markdown = has_text ? this._handle.getMarkdown() : '';
            const xhtml = has_text ? this.htmlToXhtml(this._handle.getHtml()) : undefined;
            const enclosures = this._attachments.length ? this._attachments : undefined;
            await this.model.publishPost(markdown, { xhtml, enclosures });
            this._handle?.clear();
            this._attachments = [];
            this._empty = true;
        } catch (e) {
            log.error(e);
            api.toast?.show?.('social-post-failed', {
                type: 'danger',
                body: __('Sorry, could not publish your post'),
            });
        } finally {
            this._publishing = false;
            this._handle?.focus();
        }
    }
}

api.elements.define('converse-social-compose-rich', SocialComposeRich);
