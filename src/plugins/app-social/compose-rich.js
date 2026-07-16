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
import { _converse, api, converse, log, uploadFile, PubSubFeed } from '@converse/headless';
import DOMPurify from 'dompurify';
import { CustomElement } from 'shared/components/element.js';
import { shortnamesToEmojis } from 'shared/chat/utils.js';
import { __ } from 'i18n';
import tplComposeRich from './templates/compose-rich.js';
import './emoji-dropdown.js';
import { MICROBLOG_NODE } from './constants.js';

import './styles/compose-rich.scss';

const { Strophe } = converse.env;

const MAX_SUGGESTIONS = 8; // Caps inline typeahead list

/**
 * The composer's caret-typeahead sources. Each source owns one trigger character:
 * `getQuery` reads the trigger's query from the caret (null when the caret isn't
 * on this source's trigger), `getItems` builds the ranked menu for a query, and
 * `choose` replaces the trigger with the picked item. The triggers are mutually
 * exclusive, so at most one source is active at a time.
 */
const TYPEAHEAD_SOURCES = [
    {
        kind: 'emoji',

        /** @param {SocialComposeRich} el */
        getQuery: (el) => el._handle?.getEmojiQuery?.() ?? null,

        /**
         * All emoji whose shortname contains the query, prefix matches (then
         * alphabetical) first.
         * @param {SocialComposeRich} _el
         * @param {string} query
         * @returns {Promise<import('./types').TypeaheadItem[]>}
         */
        async getItems(_el, query) {
            await api.emojis.initialize();
            const q = query.toLowerCase();
            const ranked = [];
            for (const emoji of /** @type {any[]} */ (converse.emojis.list)) {
                const idx = emoji.sn.slice(1, -1).indexOf(q); // strip the wrapping colons
                if (idx !== -1) ranked.push({ emoji, idx });
            }
            ranked.sort((a, b) => a.idx - b.idx || (a.emoji.sn < b.emoji.sn ? -1 : 1));
            return ranked.slice(0, MAX_SUGGESTIONS).map(({ emoji }) => ({
                label: emoji.sn,
                url: emoji.url,
                glyph: shortnamesToEmojis(emoji.sn, { unicode_only: true, add_title_wrapper: false }).join(''),
            }));
        },
        /**
         * @param {SocialComposeRich} el
         * @param {string} query
         * @param {import('./types').TypeaheadItem} item
         */
        choose: (el, query, item) => el._handle?.replaceEmojiTrigger(query, item.glyph),
    },
    {
        kind: 'mention',

        /** @param {SocialComposeRich} el */
        getQuery: (el) => el._handle?.getMentionQuery?.() ?? null,

        /**
         * The people whose name or JID contains the query, drawn from two pools:
         * the XEP-0330 follow list, plus authors browsed this session without
         * following them (their cached profile feeds). Microblog-node entries
         * only, since community feeds aren't people.
         * @param {SocialComposeRich} _el
         * @param {string} query
         * @returns {import('./types').TypeaheadItem[]}
         */
        getItems(_el, query) {
            /** @type {Map<string, {jid: string, name: string, followed: boolean}>} */
            const candidates = new Map();

            for (const follow of _converse.state.following?.models ?? []) {
                if (follow.get('node') !== MICROBLOG_NODE) continue;
                const jid = follow.get('server');
                const name = follow.get('title') || api.microblog.profile.get(jid).getDisplayName();
                candidates.set(jid, { jid, name, followed: true });
            }

            for (const feed of api.microblog.feeds.browsed()) {
                if (feed.get('node') !== MICROBLOG_NODE) continue;
                const jid = feed.get('jid');
                if (candidates.has(jid)) continue;
                candidates.set(jid, { jid, name: api.microblog.profile.get(jid).getDisplayName(), followed: false });
            }

            const q = query.toLowerCase();
            const ranked = [];
            for (const { jid, name, followed } of candidates.values()) {
                const name_idx = name.toLowerCase().indexOf(q);
                const jid_idx = jid.toLowerCase().indexOf(q);
                if (name_idx === -1 && jid_idx === -1) continue;
                const rank = name_idx === 0 ? 0 : jid_idx === 0 ? 1 : 2;
                ranked.push({ rank, followed, name, jid });
            }
            ranked.sort(
                (a, b) => a.rank - b.rank || Number(b.followed) - Number(a.followed) || a.name.localeCompare(b.name),
            );

            return ranked.slice(0, MAX_SUGGESTIONS).map(({ name, jid }) => ({
                label: name,
                detail: jid,
                jid,
                name,
            }));
        },

        /**
         * Insert the mention as a link, `@Name` → `xmpp:jid`: Converse renders and
         * routes `xmpp:` URIs to the profile view, other clients get a plain link,
         * and a bridge (e.g. XMPP→Nostr) can rewrite it into its own mention format.
         * @param {SocialComposeRich} el
         * @param {string} query
         * @param {import('./types').TypeaheadItem} item
         */
        choose: (el, query, item) => el._handle?.replaceMentionTrigger(query, `@${item.name}`, `xmpp:${item.jid}`),
    },
];

export default class SocialComposeRich extends CustomElement {
    static get properties() {
        return {
            model: { type: PubSubFeed },
            _publishing: { type: Boolean, state: true },
            _uploading: { type: Boolean, state: true },
            _empty: { type: Boolean, state: true },
            _attachments: { type: Array, state: true },
            _ac_items: { type: Array, state: true },
            _ac_index: { type: Number, state: true },
            _ac_pos: { type: Object, state: true },
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

        // The inline caret typeahead (emoji shortnames, mentions), open only while
        // items exist. `_ac_kind` names the source the menu is showing for.
        /** @type {import('./types').TypeaheadItem[]} */
        this._ac_items = [];
        this._ac_index = 0;
        this._ac_kind = '';

        /** @type {{ left: number, top: number }} */
        this._ac_pos = { left: 0, top: 0 };

        // The query the current items were built for (the chars after the trigger).
        this._ac_query = '';

        // The dismissal key (see `_ac_dismiss_key`) the user dismissed with Escape;
        // the menu stays closed for it until the query changes (so a later editor
        // update can't re-open the same trigger).
        /** @type {string|null} */
        this._ac_dismissed = null;

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
        this.updateTypeahead();
    }

    /**
     * The key an Escape dismissal is remembered under: the source plus its query,
     * NUL-joined (NUL can appear in neither), so dismissing e.g. `:sm` can never
     * also suppress `@sm`.
     */
    get _ac_dismiss_key() {
        return `${this._ac_kind}\x00${this._ac_query}`;
    }

    /**
     * Recompute the caret typeahead after each edit: if the caret sits on a
     * source's trigger (a `:query` / `@query` token), show that source's matches;
     * otherwise close the menu.
     */
    async updateTypeahead() {
        let source = null;
        let query = null;
        for (const candidate of TYPEAHEAD_SOURCES) {
            // N.B. sources normalize "no trigger" to null; an empty-string query is
            // valid (a bare `@` lists the whole follow list).
            query = candidate.getQuery(this);
            if (query !== null) {
                source = candidate;
                break;
            }
        }
        if (!source) {
            // The caret left every trigger, so forget any earlier Escape dismissal.
            this._ac_dismissed = null;
            return this.closeTypeahead();
        }

        // Honour an Escape dismissal: stay closed until the query actually changes.
        const dismissal = `${source.kind}\x00${query}`;
        if (dismissal === this._ac_dismissed) return this.closeTypeahead();
        this._ac_dismissed = null;

        const items = await source.getItems(this, query);

        // The caret may have moved, or the menu been dismissed, while items loaded.
        if (source.getQuery(this) !== query || this._ac_dismissed === dismissal) return;

        // Only open while the user is actually typing in the editor. Lexical keeps
        // its selection (and so the trigger query) across a blur, so without this a
        // pending update could re-open the menu after focus has moved elsewhere.
        const host = /** @type {HTMLElement} */ (this.querySelector('.social-rich__editable'));
        if (host && host !== document.activeElement && !host.contains(document.activeElement)) {
            return this.closeTypeahead();
        }

        if (!items.length) return this.closeTypeahead();

        this._ac_kind = source.kind;
        this._ac_query = query;
        this._ac_items = items;
        this._ac_index = 0;
        this._ac_pos = this.caretPosition();
    }

    /** Close the typeahead menu. */
    closeTypeahead() {
        if (this._ac_items.length) this._ac_items = [];
    }

    /** The typeahead menu's inline position, as a single CSS declaration string. */
    get typeaheadStyle() {
        return `left: ${this._ac_pos.left}px; top: ${this._ac_pos.top}px`;
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
     * Keyboard navigation for the typeahead menu. Intercepts arrows / Enter / Tab /
     * Escape only while the menu is open, keeping them away from Lexical (which
     * handles the same keys on the same element).
     * @param {KeyboardEvent} ev
     */
    onEditorKeyDown(ev) {
        if (!this._ac_items.length) {
            if (ev.key === 'Escape' && this._menu_closed_by_blur) {
                // This Escape's own blur (an extension blurring the editor before
                // we ran) already closed the menu: finish the dismissal by
                // reclaiming focus, and consume the event so the editor's own
                // blur-on-Escape doesn't immediately re-blur. A bare Escape (no
                // menu involved) falls through instead, and blurs. That is the
                // keyboard user's escape hatch out of the editor.
                this._menu_closed_by_blur = false;
                this._ac_dismissed = this._ac_dismiss_key;
                ev.preventDefault();
                ev.stopImmediatePropagation();
                this._handle?.focus();
            }
            return;
        }

        switch (ev.key) {
            case 'ArrowDown':
                this.moveTypeaheadSelection(1);
                break;
            case 'ArrowUp':
                this.moveTypeaheadSelection(-1);
                break;
            case 'Enter':
            case 'Tab':
                this.chooseSuggestion(this._ac_index);
                break;
            case 'Escape':
                // Remember the dismissal so a later editor update can't re-open it,
                // and put focus back in the editor with the caret where it was.
                this._ac_dismissed = this._ac_dismiss_key;
                this.closeTypeahead();
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
        const had_menu = this._ac_items.length > 0;
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

        this.closeTypeahead();

        // Vimium (and kin) can swallow the Escape keydown entirely, so the page
        // never sees the key. This blur is the only signal. A keyboard-initiated
        // blur to nowhere while the menu was open can only be such a dismissal,
        // so reclaim focus for the editor. A pointer-initiated blur (a click
        // elsewhere), a focus move to a real element, or the window itself losing
        // focus must all genuinely take focus away instead.
        if (had_menu && !ev?.relatedTarget && !this._pointer_down) {
            const dismissed = this._ac_dismiss_key;
            setTimeout(() => {
                if (document.hasFocus() && document.activeElement === document.body) {
                    this._ac_dismissed = dismissed;
                    this._handle?.focus();
                }
            });
        }
    }

    /**
     * Move the active suggestion, wrapping around the ends.
     * @param {number} delta
     */
    moveTypeaheadSelection(delta) {
        const n = this._ac_items.length;
        if (n) this._ac_index = (this._ac_index + delta + n) % n;
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
     * Insert the chosen item in place of the trigger, via the active source.
     * @param {number} index
     */
    chooseSuggestion(index) {
        const item = this._ac_items[index];
        const source = TYPEAHEAD_SOURCES.find((s) => s.kind === this._ac_kind);
        if (!item || !source) return;
        source.choose(this, this._ac_query, item);
        this.closeTypeahead();
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
        const div = document.createElementNS(Strophe.NS.XHTML, 'div');
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
