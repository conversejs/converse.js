import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';


const i18n_minimized = __('Minimized')


export default (o) => html`
    ${o.num_minimized} ${i18n_minimized}
    <span class="unread-message-count ${!o.num_unread ? 'unread-message-count-hidden' : ''}" href="#">${o.num_unread}</span>
`;
