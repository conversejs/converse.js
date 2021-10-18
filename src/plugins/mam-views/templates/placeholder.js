import tpl_spinner from 'templates/spinner.js';
import { __ } from 'i18n';
import { html } from 'lit/html.js';

export default (el) => {
    return el.model.get('fetching') ? tpl_spinner({'classes': 'hor_centered'}) :
        html`<a @click="${(ev) => el.fetchMissingMessages(ev)}" title="${__('Click to load missing messages')}">
            <div class="message mam-placeholder"></div>
        </a>`;
}
