import { html } from "lit";
import { __ } from 'i18n';

/**
 * @param {import('shared/components/contacts-filter').ContactsFilter} el
 */
export default (el) => {
    const i18n_placeholder = __('Filter');
    const title_contact_filter = __('Filter by name');
    const title_status_filter = __('Filter by status');
    const label_any = __('Any');
    const label_online = __('Online');
    const label_chatty = __('Chatty');
    const label_busy = __('Busy');
    const label_away = __('Away');
    const label_xa = __('Extended Away');
    const label_offline = __('Offline');

    const chat_state = el.filter.get('chat_state');
    const filter_text = el.filter.get('filter_text');
    const filter_type = el.filter.get('filter_type');

    return html`
        <form class="contacts-filter-form input-button-group ${ (!el.shouldBeVisible()) ? 'hidden' : 'fade-in' }"
              @submit=${ev => el.submitFilter(ev)}>
            <div class="form-inline flex-nowrap">
                <div class="filter-by d-flex flex-nowrap">
                    <converse-icon
                            size="1em"
                            @click=${ev => el.changeTypeFilter(ev)}
                            class="fa fa-user clickable ${ (filter_type === 'contacts') ? 'selected' : '' }"
                            data-type="contacts"
                            title="${title_contact_filter}"></converse-icon>
                    <converse-icon
                            size="1em"
                            @click=${ev => el.changeTypeFilter(ev)}
                            class="fa fa-circle clickable ${ (filter_type === 'state') ? 'selected' : '' }"
                            data-type="state"
                            title="${title_status_filter}"></converse-icon>
                </div>
                <div class="btn-group">
                    <input .value="${filter_text || ''}"
                        @keydown=${ev => el.liveFilter(ev)}
                        class="contacts-filter form-control ${ (filter_type === 'state') ? 'hidden' : '' }"
                        placeholder="${i18n_placeholder}"/>
                    <converse-icon size="1em"
                                   class="fa fa-times clear-input ${ (!filter_text || filter_type === 'state') ? 'hidden' : '' }"
                                   @click=${ev => el.clearFilter(ev)}>
                    </converse-icon>
                </div>
                <select class="form-control state-type ${ (filter_type !== 'state') ? 'hidden' : '' }"
                        @change=${ev => el.changeChatStateFilter(ev)}>
                    <option value="">${label_any}</option>
                    <option ?selected=${chat_state === 'online'} value="online">${label_online}</option>
                    <option ?selected=${chat_state === 'chat'} value="chat">${label_chatty}</option>
                    <option ?selected=${chat_state === 'dnd'} value="dnd">${label_busy}</option>
                    <option ?selected=${chat_state === 'away'} value="away">${label_away}</option>
                    <option ?selected=${chat_state === 'xa'} value="xa">${label_xa}</option>
                    <option ?selected=${chat_state === 'offline'} value="offline">${label_offline}</option>
                </select>
            </div>
        </form>`
};
