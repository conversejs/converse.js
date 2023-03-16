import tplOccupant from "./occupant.js";
import { __ } from 'i18n';
import { html } from "lit";
import { repeat } from 'lit/directives/repeat.js';


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
        <ul class="occupant-list">${ repeat(o.occupants, (occ) => occ.get('jid'), (occ) => tplOccupant(occ, o)) }</ul>
    `;
}
