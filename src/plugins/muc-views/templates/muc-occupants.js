/**
 * @typedef {import('@converse/headless').MUCOccupant} MUCOccupant
 */
import { html } from "lit";
import { repeat } from 'lit/directives/repeat.js';
import { __ } from 'i18n';
import 'shared/components/list-filter.js';
import './../sidebar-occupant.js';
import tplOccupantsFilter from './occupants-filter.js';

/**
 * @param {import('../occupants').default} el
 * @param {MUCOccupant} occ
 */
function isOccupantFiltered (el, occ) {
    if (!el.model.get('filter_visible')) return false;

    const type = el.filter.get('type');
    const q = (type === 'state') ? el.filter.get('state').toLowerCase() : el.filter.get('text').toLowerCase();

    if (!q) return false;

    if (type === 'state') {
        const presence = occ.get('presence');
        if (q === 'online') {
            return ["offline", "unavailable"].includes(presence);
        } else if (q === 'ofline') {
            return presence === 'online';
        }
        return !occ.get('show')?.includes(q);
    } else if (type === 'items')  {
        return !occ.getDisplayName().toLowerCase().includes(q);
    }
}

/**
 * @param {import('../occupants').default} el
 */
export default (el) => {
    const i18n_participants = el.model.occupants === 1 ? __('Participant') : __('Participants');
    const i18n_close = __('Hide');
    const i18n_show_filter = __('Show filter');
    const i18n_hide_filter = __('Hide filter');
    const is_filter_visible = el.model.get('filter_visible');
    const i18n_invite = __('Invite someone')
    const i18n_invite_title = __('Invite someone to join this groupchat')

    const btns = /** @type {TemplateResult[]} */ [];

    if (el.model.invitesAllowed()) {
        btns.push(html`
            <a href="#"
               class="dropdown-item open-invite-modal"
               role="button"
               title="${i18n_invite_title}"
               @click=${(/** @type {MouseEvent} */ev) => el.showInviteModal(ev)}>
                <converse-icon size="1em" class="fa fa-user-plus"></converse-icon>
                ${i18n_invite}
            </a>
        `);
    }

    if (el.model.occupants.length > 5) {
        btns.push(html`
            <a href="#"
               class="dropdown-item toggle-filter"
               role="button"
               @click=${(/** @type {MouseEvent} */ev) => el.toggleFilter(ev)}>
                <converse-icon size="1em" class="fa fa-filter"></converse-icon>
                ${is_filter_visible ? i18n_hide_filter : i18n_show_filter}
            </a>
        `);
    }

    if (btns.length) {
        btns.push(html`
            <a href="#" class="dropdown-item" role="button"
                @click=${(/** @type {MouseEvent} */ev) => el.closeSidebar(ev)}>
                <converse-icon size="1em" class="fa fa-times"></converse-icon>
                ${i18n_close}
            </a>
        `);
    } else {
        // Only a single button is shown, not a dropdown.
        btns.push(
            html` <i class="hide-occupants" @click=${(/** @type {MouseEvent} */ev) => el.closeSidebar(ev)}>
                <converse-icon class="fa fa-times" size="1em"></converse-icon>
            </i>`
        );
    }

    return html`
        <div class="occupants">
            <div class="occupants-header">
                <div class="occupants-header--title">
                    <span class="occupants-heading sidebar-heading">${el.model.occupants.length} ${i18n_participants}</span>
                    ${btns.length === 1
                        ? btns[0]
                            : html`<converse-dropdown
                                class="chatbox-btn btn-group dropstart"
                                .items=${btns}></converse-dropdown>`}
                </div>
            </div>
            <ul class="items-list occupant-list">
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
                    (occ) => isOccupantFiltered(el, occ) ? '' : html`<converse-muc-occupant-list-item .muc="${el.model}" .model="${occ}" />`
                )}
            </ul>
        </div>
    `;
};
