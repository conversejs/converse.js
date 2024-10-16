import 'shared/components/list-filter.js';
import { __ } from 'i18n';
import { html } from "lit";

/**
 * @param {import('../sidebar').default} el
 */
export default (el) => {
    return html`
        <div class="dragresize-occupants-left">&nbsp;</div>
        <converse-muc-occupants jid="${el.jid}"></converse-muc-occupants>
    `;
};
