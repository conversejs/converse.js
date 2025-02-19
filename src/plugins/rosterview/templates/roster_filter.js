/**
 * @typedef {import('shared/components/list-filter').default} ListFilter
 */
import { html } from "lit";
import { __ } from 'i18n';
import { PRETTY_CHAT_STATUS } from "shared/constants";

/**
 * @param {ListFilter} el
 */
export default (el) => {
    const i18n_placeholder = __('Filter');
    const title_contact_filter = __('Filter by contact name');
    const title_group_filter = __('Filter by group name');
    const title_status_filter = __('Filter by status');
    const label_any = __('Any');
    const label_unread_messages = __('Unread');

    const {
        offline: label_offline,
        xa: label_xa,
        away: label_away,
        dnd: label_dnd,
        chat: label_chatty,
        online: label_online,
    } = PRETTY_CHAT_STATUS;

    const chat_state = el.model.get('state');
    const filter_text = el.model.get('text');
    const filter_type = el.model.get('type');

    return html`
        <form class="controlbox-padded items-filter-form input-button-group ${ !el.shouldBeVisible() ? 'hidden' : 'fade-in' }"
              @submit=${ev => el.submitFilter(ev)}>
            <div class="flex-nowrap">
                <div class="filter-by d-flex flex-nowrap">
                    <converse-icon size="1em" @click=${ev => el.changeTypeFilter(ev)} class="fa fa-user clickable ${ (filter_type === 'items') ? 'selected' : '' }" data-type="items" title="${title_contact_filter}"></converse-icon>
                    <converse-icon size="1em" @click=${ev => el.changeTypeFilter(ev)} class="fa fa-users clickable ${ (filter_type === 'groups') ? 'selected' : '' }" data-type="groups" title="${title_group_filter}"></converse-icon>
                    <converse-icon size="1em" @click=${ev => el.changeTypeFilter(ev)} class="fa fa-circle clickable ${ (filter_type === 'state') ? 'selected' : '' }" data-type="state" title="${title_status_filter}"></converse-icon>
                </div>
                <div class="btn-group">
                    <input .value="${filter_text || ''}"
                        @keydown=${ev => el.liveFilter(ev)}
                        class="items-filter form-control ${ (filter_type === 'state') ? 'hidden' : '' }"
                        placeholder="${i18n_placeholder}"/>
                    <converse-icon size="1em"
                                   class="fa fa-times clear-input ${ (!filter_text || filter_type === 'state') ? 'hidden' : '' }"
                                   @click=${ev => el.clearFilter(ev)}>
                    </converse-icon>
                </div>
                <select class="form-control state-type ${ (filter_type !== 'state') ? 'hidden' : '' }"
                        @change=${ev => el.changeChatStateFilter(ev)}>
                    <option value="">${label_any}</option>
                    <option ?selected=${chat_state === 'unread_messages'} value="unread_messages">${label_unread_messages}</option>
                    <option ?selected=${chat_state === 'online'} value="online">${label_online}</option>
                    <option ?selected=${chat_state === 'chat'} value="chat">${label_chatty}</option>
                    <option ?selected=${chat_state === 'dnd'} value="dnd">${label_dnd}</option>
                    <option ?selected=${chat_state === 'away'} value="away">${label_away}</option>
                    <option ?selected=${chat_state === 'xa'} value="xa">${label_xa}</option>
                    <option ?selected=${chat_state === 'offline'} value="offline">${label_offline}</option>
                </select>
            </div>
        </form>`
};
