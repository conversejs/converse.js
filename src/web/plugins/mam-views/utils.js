import { html } from 'lit/html.js';
import { MAMPlaceholderMessage } from '@converse/headless';

export function getPlaceholderTemplate(message, tpl) {
    if (message instanceof MAMPlaceholderMessage) {
        return html`<converse-mam-placeholder .model=${message}></converse-mam-placeholder>`;
    } else {
        return tpl;
    }
}
