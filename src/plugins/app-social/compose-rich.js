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
import { EMOJI_SOURCE } from 'shared/rich-composer/emoji-source.js';
import { MENTION_TRIGGER } from 'shared/rich-composer/triggers.js';
import { TypeaheadController, MAX_SUGGESTIONS } from 'shared/rich-composer/typeahead.js';
import { __ } from 'i18n';
import tplComposeRich from './templates/compose-rich.js';
import { MICROBLOG_NODE } from './constants.js';
import './emoji-dropdown.js';

import './styles/compose-rich.scss';
import 'shared/rich-composer/styles/typeahead.scss';

const { Strophe } = converse.env;

const TYPEAHEAD_SOURCES = [
    EMOJI_SOURCE,
    {
        kind: 'mention',

        getQuery: (handle) => handle?.getTriggerQuery?.(MENTION_TRIGGER) ?? null,

        /**
         * The people whose name or JID contains the query, drawn from two pools:
         * the XEP-0330 follow list, plus authors browsed this session without
         * following them (their cached profile feeds). Microblog-node entries
         * only, since community feeds aren't people.
         * @param {string} query
         * @returns {import('shared/rich-composer/types').TypeaheadItem[]}
         */
        getItems(query) {
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
         * @param {import('shared/rich-composer/types').RichEditor} handle
         * @param {string} query
         * @param {import('shared/rich-composer/types').TypeaheadItem} item
         */
        choose: (handle, query, item) =>
            handle?.replaceTriggerWithLink(`@${query}`, `@${item.name}`, `xmpp:${item.jid}`),
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

        this.typeahead = new TypeaheadController(this, {
            sources: TYPEAHEAD_SOURCES,
            getHandle: () => this._handle,
            container: '.social-rich',
            editable: '.social-rich__editable',
        });
    }

    render() {
        return tplComposeRich(this);
    }

    disconnectedCallback() {
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
        this.typeahead.update();
    }

    /**
     * Let the typeahead claim arrows / Enter / Tab / Escape while its menu is open.
     * @param {KeyboardEvent} ev
     */
    onEditorKeyDown(ev) {
        this.typeahead.onKeyDown(ev);
    }

    /**
     * @param {FocusEvent} [ev]
     */
    onEditorFocusOut(ev) {
        this.typeahead.onFocusOut(ev);
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
