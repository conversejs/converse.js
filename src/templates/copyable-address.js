import { html } from 'lit';
import { __ } from 'i18n';
import 'shared/components/copy-button.js';

/**
 * An XMPP address with a button that copies it to the clipboard.
 * @param {string} jid
 */
export default (jid) => {
    const i18n_copy_address = __('Copy address to clipboard');
    return html`<span class="d-inline-flex align-items-center gap-1">
        <span class="text-break">${jid}</span>
        <converse-copy-button .text=${jid} label="${i18n_copy_address}"></converse-copy-button>
    </span>`;
};
