import { html } from "lit";
import { __ } from 'i18n';
import tpl_occupant from "./occupant.js";


export default (o) => {
    const i18n_participants = o.occupants.length === 1 ? __('Participant') : __('Participants');
    return html`
        <div class="occupants-header">
            <div class="occupants-header--title">
                <span class="occupants-heading">${o.occupants.length} ${i18n_participants}</span>
                <i class="hide-occupants" @click=${o.closeSidebar}>
                    <converse-icon class="fa fa-times" size="1em"></converse-icon>
                </i>
            </div>
        </div>
        <div class="dragresize dragresize-occupants-left"></div>
        <ul class="occupant-list">${o.occupants.map(occ => tpl_occupant(occ, o))}</ul>
    `;
}
