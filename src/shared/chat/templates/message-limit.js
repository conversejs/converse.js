import { __ } from 'i18n';
import { html } from 'lit';

export default (counter) => {
    const i18n_chars_remaining = __('Message characters remaining');
    return html`<span class="message-limit ${counter < 1 ? 'error' : ''}" title="${i18n_chars_remaining}">${counter}</span>`;
}
