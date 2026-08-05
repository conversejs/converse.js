import { html } from 'lit';
import { api } from '@converse/headless';
import { __ } from 'i18n';
import { CustomElement } from './element.js';
import './styles/copy-button.scss';

/**
 * A button that puts a string on the clipboard, showing a brief checkmark once
 * it has. Meant for the opaque identifiers we show but nobody wants to retype:
 * an OMEMO fingerprint, a JID.
 */
export class CopyButton extends CustomElement {
    static get properties() {
        return {
            text: { type: String },
            label: { type: String },
            copied: { type: Boolean, state: true },
        };
    }

    constructor() {
        super();
        this.text = '';
        this.label = '';
        this.copied = false;
        this.timeout = null;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        clearTimeout(this.timeout);
    }

    render() {
        const label = this.label || __('Copy to clipboard');
        return html`<button
            type="button"
            class="btn btn-sm copy-button"
            title="${this.copied ? __('Copied') : label}"
            aria-label="${label}"
            @click=${(ev) => this.copy(ev)}
        >
            <converse-icon size="1em" class="fa ${this.copied ? 'fa-check' : 'fa-copy'}"></converse-icon>
        </button>`;
    }

    /**
     * @param {MouseEvent} ev
     */
    async copy(ev) {
        ev.preventDefault();
        ev.stopPropagation(); // the button often sits inside something clickable
        await navigator.clipboard.writeText(this.text);
        this.copied = true;
        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => (this.copied = false), 1500);
    }
}

api.elements.define('converse-copy-button', CopyButton);
