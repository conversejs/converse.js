import 'shared/components/contacts-filter.js';
import tplOccupant from "./occupant.js";
import tplOccupantsFilter from './occupants-filter.js';
import { __ } from 'i18n';
import { html } from "lit";
import { repeat } from 'lit/directives/repeat.js';

function isOccupantFiltered (el, occ) {
    const type = el.filter.get('filter_type');
    const q = (type === 'state') ?
        el.filter.get('chat_state').toLowerCase() :
        el.filter.get('filter_text').toLowerCase();

    if (!q) return false;

    if (type === 'state') {
        const show = occ.get('show');
        return q === 'online' ? ["offline", "unavailable"].includes(show) : !show.includes(q);
    } else if (type === 'contacts')  {
        return !occ.getDisplayName().toLowerCase().includes(q);
    }
}

function shouldShowOccupant (el, occ, o) {
    return isOccupantFiltered(el, occ) ? '' : tplOccupant(occ, o);
}

export default (el, o) => {
    const i18n_participants = o.occupants.length === 1 ? __('Participant') : __('Participants');
    return html`
        <div class="occupants-header">
            <div class="occupants-header--title">
                <span class="occupants-heading">${o.occupants.length} ${i18n_participants}</span>
                <i class="hide-occupants" @click=${ev => el.closeSidebar(ev)}>
                    <converse-icon class="fa fa-times" size="1em"></converse-icon>
                </i>
            </div>
        </div>
        <div class="dragresize dragresize-occupants-left"></div>
        <ul class="occupant-list">
            <converse-contacts-filter
                    @update=${() => el.requestUpdate()}
                    .promise=${el.model.initialized}
                    .contacts=${el.model.occupants}
                    .template=${tplOccupantsFilter}
                    .filter=${el.filter}></converse-contacts-filter>

            ${ repeat(o.occupants, (occ) => occ.get('jid'), (occ) => shouldShowOccupant(el, occ, o)) }
        </ul>
    `;
}
