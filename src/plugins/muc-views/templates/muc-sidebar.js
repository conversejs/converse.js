/**
 * @typedef {import('plugins/muc-views/sidebar').default} MUCSidebar
 * @typedef {import('headless/plugins/muc/occupant').default} Occupant
 */
import 'shared/components/list-filter.js';
import tplOccupant from "./occupant.js";
import tplOccupantsFilter from './occupants-filter.js';
import { __ } from 'i18n';
import { html } from "lit";
import { repeat } from 'lit/directives/repeat.js';

/**
 * @param {MUCSidebar} el
 * @param {Occupant} occ
 */
function isOccupantFiltered (el, occ) {
    const type = el.filter.get('type');
    const q = (type === 'state') ? el.filter.get('state').toLowerCase() : el.filter.get('text').toLowerCase();

    if (!q) return false;

    if (type === 'state') {
        const show = occ.get('show');
        return q === 'online' ? ["offline", "unavailable"].includes(show) : !show.includes(q);
    } else if (type === 'items')  {
        return !occ.getDisplayName().toLowerCase().includes(q);
    }
}

/**
 * @param {MUCSidebar} el
 * @param {Occupant} occ
 * @param {Object} o
 */
function shouldShowOccupant (el, occ, o) {
    return isOccupantFiltered(el, occ) ? '' : tplOccupant(occ, o);
}

/**
 * @param {MUCSidebar} el
 * @param {Object} o
 */
export default (el, o) => {
    const i18n_participants = o.occupants.length === 1 ? __('Participant') : __('Participants');
    return html`
        <div class="occupants-header">
            <div class="occupants-header--title">
                <span class="occupants-heading">${o.occupants.length} ${i18n_participants}</span>
                <i class="hide-occupants" @click=${(ev) => el.closeSidebar(ev)}>
                    <converse-icon class="fa fa-times" size="1em"></converse-icon>
                </i>
            </div>
        </div>
        <div class="dragresize dragresize-occupants-left"></div>
        <ul class="occupant-list">
            <converse-list-filter
                    @update=${() => el.requestUpdate()}
                    .promise=${el.model.initialized}
                    .items=${el.model.occupants}
                    .template=${tplOccupantsFilter}
                    .model=${el.filter}></converse-list-filter>

            ${ repeat(o.occupants, (occ) => occ.get('jid'), (occ) => shouldShowOccupant(el, occ, o)) }
        </ul>
    `;
}
