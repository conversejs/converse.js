import { html } from "lit";
import { __ } from 'i18n';
import tpl_occupant from "./occupant.js";


export default (o) => {
    const i18n_participants = __('Participants');
    return html`
        <div class="occupants-header">
            <i class="hide-occupants" @click=${o.closeSidebar}>
                <converse-icon color="var(--subdued-color)" class="fa fa-times" size="1em"></converse-icon>
            </i>
            <div class="occupants-header--title">
                <span class="occupants-heading">${i18n_participants}</span>
            </div>
        </div>
        <div class="dragresize dragresize-occupants-left"></div>
        <ul class="occupant-list">${o.occupants.map(occ => tpl_occupant(occ, o))}</ul>
    `;
}
