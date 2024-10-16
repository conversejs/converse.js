import { html } from 'lit';

/**
 * @param {import('../sidebar').default} el
 */
export default (el) => {
    const model = el.model;
    const sidebar_view = model.get('sidebar_view');
    const occupant_id = sidebar_view.split('occupant:').pop();
    return html`
        <div class="dragresize-occupants-left">&nbsp;</div>
        ${sidebar_view?.startsWith('occupant:')
            ? html`<converse-muc-occupant muc_jid="${el.jid}" occupant_id="${occupant_id}"></converse-muc-occupant>`
            : html`<converse-muc-occupants jid="${el.jid}"></converse-muc-occupants>`}
    `;
};
