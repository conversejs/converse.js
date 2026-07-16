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
import { api, log, PubSubFeed } from '@converse/headless';
import DOMPurify from 'dompurify';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import tplComposeRich from './templates/compose-rich.js';
import './emoji-dropdown.js';

import './styles/compose-rich.scss';

const NS_XHTML = 'http://www.w3.org/1999/xhtml';

export default class SocialComposeRich extends CustomElement {
    static get properties() {
        return {
            model: { type: PubSubFeed },
            _publishing: { type: Boolean, state: true },
            _empty: { type: Boolean, state: true },
        };
    }

    constructor() {
        super();
        this._publishing = false;
        this._empty = true;
        // The Lexical editor handle, created lazily on first focus (see ensureEditor).
        /** @type {import('./types').EditorHandle|null} */
        this._handle = null;
        /** @type {Promise<import('./types').EditorHandle>|null} */
        this._init = null;
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
        if (this._publishing || !this._handle || this._handle.isEmpty()) return;

        this._publishing = true;
        try {
            const markdown = this._handle.getMarkdown();
            const xhtml = this.htmlToXhtml(this._handle.getHtml());
            await this.model.publishPost(markdown, { xhtml });
            this._handle.clear();
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
