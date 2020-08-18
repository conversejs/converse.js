import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';


export default (o) => html`
    ${o.num_minimized} ${__('Minimized')}
    <span class="unread-message-count ${!o.num_unread ? 'unread-message-count-hidden' : ''}" href="#">${o.num_unread}</span>
`;
