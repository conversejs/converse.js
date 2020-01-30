import { html } from "lit-html";


export default (o) => html`
    <form class="controlbox-padded roster-filter-form input-button-group ${ (!o.visible) ? 'hidden' : 'fade-in' }"
          @submit=${o.submitFilter}>
        <div class="form-inline flex-nowrap">
            <div class="filter-by d-flex flex-nowrap">
                <span @click=${o.changeTypeFilter} class="fa fa-user ${ (o.filter_type === 'contacts') ? 'selected' : '' }" data-type="contacts" title="${o.title_contact_filter}"></span>
                <span @click=${o.changeTypeFilter} class="fa fa-users ${ (o.filter_type === 'groups') ? 'selected' : '' }" data-type="groups" title="${o.title_group_filter}"></span>
                <span @click=${o.changeTypeFilter} class="fa fa-circle ${ (o.filter_type === 'state') ? 'selected' : '' }" data-type="state" title="${o.title_status_filter}"></span>
            </div>
            <div class="btn-group">
                <input .value="${o.filter_text || ''}"
                       @keydown=${o.liveFilter}
                       class="roster-filter form-control ${ (o.filter_type === 'state') ? 'hidden' : '' }"
                       placeholder="${o.placeholder}"/>
                <span class="clear-input fa fa-times ${ (!o.filter_text || o.filter_type === 'state') ? 'hidden' : '' }"
                      @click=${o.clearFilter}>
                </span>
            </div>
            <select class="form-control state-type ${ (o.filter_type !== 'state') ? 'hidden' : '' }"
                    @change=${o.changeChatStateFilter}>
                <option value="">${o.label_any}</option>
                <option ?selected=${o.chat_state === 'unread_messages'} value="unread_messages">${o.label_unread_messages}</option>
                <option ?selected=${o.chat_state === 'online'} value="online">${o.label_online}</option>
                <option ?selected=${o.chat_state === 'chat'} value="chat">${o.label_chatty}</option>
                <option ?selected=${o.chat_state === 'dnd'} value="dnd">${o.label_busy}</option>
                <option ?selected=${o.chat_state === 'away'} value="away">${o.label_away}</option>
                <option ?selected=${o.chat_state === 'xa'} value="xa">${o.label_xa}</option>
                <option ?selected=${o.chat_state === 'offline'} value="offline">${o.label_offline}</option>
            </select>
        </div>
    </form>
`;
