import { html } from "lit";
import { __ } from 'i18n';


export default (o) => {
    const i18n_placeholder = __('Filter');
    const title_contact_filter = __('Filter by contact name');
    const title_group_filter = __('Filter by group name');
    const title_status_filter = __('Filter by status');
    const label_any = __('Any');
    const label_unread_messages = __('Unread');
    const label_online = __('Online');
    const label_chatty = __('Chatty');
    const label_busy = __('Busy');
    const label_away = __('Away');
    const label_xa = __('Extended Away');
    const label_offline = __('Offline');

    return html`
        <form class="controlbox-padded roster-filter-form input-button-group ${ (!o.visible) ? 'hidden' : 'fade-in' }"
            @submit=${o.submitFilter}>
            <div class="form-inline flex-nowrap">
                <div class="filter-by d-flex flex-nowrap">
                    <converse-icon size="1em" @click=${o.changeTypeFilter} class="fa fa-user clickable ${ (o.filter_type === 'contacts') ? 'selected' : '' }" data-type="contacts" title="${title_contact_filter}"></converse-icon>
                    <converse-icon size="1em" @click=${o.changeTypeFilter} class="fa fa-users clickable ${ (o.filter_type === 'groups') ? 'selected' : '' }" data-type="groups" title="${title_group_filter}"></converse-icon>
                    <converse-icon size="1em" @click=${o.changeTypeFilter} class="fa fa-circle clickable ${ (o.filter_type === 'state') ? 'selected' : '' }" data-type="state" title="${title_status_filter}"></converse-icon>
                </div>
                <div class="btn-group">
                    <input .value="${o.filter_text || ''}"
                        @keydown=${o.liveFilter}
                        class="roster-filter form-control ${ (o.filter_type === 'state') ? 'hidden' : '' }"
                        placeholder="${i18n_placeholder}"/>
                    <converse-icon size="1em" class="fa fa-times clear-input ${ (!o.filter_text || o.filter_type === 'state') ? 'hidden' : '' }"
                        @click=${o.clearFilter}>
                    </converse-icon>
                </div>
                <select class="form-control state-type ${ (o.filter_type !== 'state') ? 'hidden' : '' }"
                        @change=${o.changeChatStateFilter}>
                    <option value="">${label_any}</option>
                    <option ?selected=${o.chat_state === 'unread_messages'} value="unread_messages">${label_unread_messages}</option>
                    <option ?selected=${o.chat_state === 'online'} value="online">${label_online}</option>
                    <option ?selected=${o.chat_state === 'chat'} value="chat">${label_chatty}</option>
                    <option ?selected=${o.chat_state === 'dnd'} value="dnd">${label_busy}</option>
                    <option ?selected=${o.chat_state === 'away'} value="away">${label_away}</option>
                    <option ?selected=${o.chat_state === 'xa'} value="xa">${label_xa}</option>
                    <option ?selected=${o.chat_state === 'offline'} value="offline">${label_offline}</option>
                </select>
            </div>
        </form>`
};
