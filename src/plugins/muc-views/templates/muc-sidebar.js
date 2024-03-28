/**
 * @typedef {import('plugins/muc-views/sidebar').default} MUCSidebar
 * @typedef {import('@converse/headless').MUCOccupant} MUCOccupant
 */
import 'shared/components/list-filter.js';
import tplOccupant from "./occupant.js";
import tplOccupantsFilter from './occupants-filter.js';
import { __ } from 'i18n';
import { html } from "lit";
import { repeat } from 'lit/directives/repeat.js';

/**
 * @param {MUCSidebar} el
 * @param {MUCOccupant} occ
 */
function isOccupantFiltered (el, occ) {
    if (!el.model.get('filter_visible')) return false;

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
 * @param {MUCOccupant} occ
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
    const i18n_participants = el.model.occupants === 1 ? __('Participant') : __('Participants');
    const i18n_close = __('Hide sidebar');
    const i18n_show_filter = __('Show filter');
    const i18n_hide_filter = __('Hide filter');
    const is_filter_visible = el.model.get('filter_visible');

    const btns = /** @type {TemplateResult[]} */ [];
    if (el.model.occupants < 6) {
        // We don't show the filter
        btns.push(
            html` <i class="hide-occupants" @click=${(/** @type {MouseEvent} */ev) => el.closeSidebar(ev)}>
                <converse-icon class="fa fa-times" size="1em"></converse-icon>
            </i>`
        );
    } else {
        btns.push(html`
            <a href="#" class="dropdown-item" @click=${(/** @type {MouseEvent} */ev) => el.closeSidebar(ev)}>
                <converse-icon size="1em" class="fa fa-times"></converse-icon>
                ${i18n_close}
            </a>
        `);
        btns.push(html`
            <a href="#" class="dropdown-item toggle-filter" @click=${(/** @type {MouseEvent} */ev) => el.toggleFilter(ev)}>
                <converse-icon size="1em" class="fa fa-filter"></converse-icon>
                ${is_filter_visible ? i18n_hide_filter : i18n_show_filter}
            </a>
        `);
    }

    return html`
        <div class="occupants-header">
            <div class="occupants-header--title">
                <span class="occupants-heading">${el.model.occupants.length} ${i18n_participants}</span>
                ${btns.length === 1
                    ? btns[0]
                    : html`<converse-dropdown class="chatbox-btn dropleft" .items=${btns}></converse-dropdown>`}
            </div>
        </div>
        <div class="dragresize dragresize-occupants-left"></div>
        <ul class="occupant-list">
            ${is_filter_visible
                ? html` <converse-list-filter
                      @update=${() => el.requestUpdate()}
                      .promise=${el.model.initialized}
                      .items=${el.model.occupants}
                      .template=${tplOccupantsFilter}
                      .model=${el.filter}
                  ></converse-list-filter>`
                : ''}
            ${repeat(
                el.model.occupants.models,
                (occ) => occ.get('jid'),
                (occ) => shouldShowOccupant(el, occ, o)
            )}
        </ul>
    `;
};
