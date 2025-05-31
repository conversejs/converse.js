import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { _converse, api, constants } from '@converse/headless';
import tplGroup from './group.js';
import tplRosterFilter from './roster_filter.js';
import { __ } from 'i18n';
import {
    shouldShowContact,
    shouldShowGroup,
    populateContactsMap,
    groupsComparator,
    contactsComparator,
} from '../utils.js';

const { CLOSED } = constants;

/**
 * @param {import('../rosterview').default} el
 */
export default (el) => {
    const i18n_heading_contacts = __('Contacts');
    const i18n_toggle_contacts = __('Click to toggle contacts');
    const i18n_title_add_contact = __('Add a contact');
    const i18n_title_new_chat = __('Start a new chat');
    const i18n_show_blocklist = __('Show block list');
    const { state } = _converse;
    const roster = [
        ...(state.roster || []),
        ...api.settings.get('show_self_in_roster') ? [state.xmppstatus] : []
    ];

    const contacts_map = roster.reduce((acc, contact) => populateContactsMap(acc, contact), {});
    const groupnames = Object.keys(contacts_map).filter((contact) => shouldShowGroup(contact, el.model));
    const is_closed = el.model.get('toggle_state') === CLOSED;
    groupnames.sort(groupsComparator);

    const i18n_show_filter = __('Show filter');
    const i18n_hide_filter = __('Hide filter');
    const is_filter_visible = el.model.get('filter_visible');

    const btns = /** @type {TemplateResult[]} */ [];
    if (api.settings.get('allow_contact_requests')) {
        btns.push(html`
            <a
                href="#"
                class="dropdown-item add-contact" role="button"
                @click="${(/** @type {MouseEvent} */ ev) => el.showAddContactModal(ev)}"
                title="${i18n_title_add_contact}"
                data-toggle="modal"
                data-target="#add-contact-modal"
            >
                <converse-icon class="fa fa-user-plus" size="1em"></converse-icon>
                ${i18n_title_add_contact}
            </a>
        `);
    }

    if (api.settings.get('allow_non_roster_messaging')) {
        btns.push(html`
            <a
                href="#"
                class="dropdown-item new-chat" role="button"
                @click="${(/** @type {MouseEvent} */ ev) => el.showNewChatModal(ev)}"
                title="${i18n_title_new_chat}"
                data-toggle="modal"
                data-target="#new-chat-modal"
            >
                <converse-icon class="fa fa-user-plus" size="1em"></converse-icon>
                ${i18n_title_new_chat}
            </a>
        `);
    }

    btns.push(html`
        <a
            href="#"
            class="dropdown-item" role="button"
            @click="${(/** @type {MouseEvent} */ ev) => el.showBlocklistModal(ev)}"
            title="${i18n_show_blocklist}"
        >
            <converse-icon class="fa fa-list-ul" size="1em"></converse-icon>
            ${i18n_show_blocklist}
        </a>
    `);

    if (roster.length > 5) {
        btns.push(html`
            <a href="#"
               class="dropdown-item toggle-filter" role="button"
               @click="${(/** @type {MouseEvent} */ ev) => el.toggleFilter(ev)}">
                <converse-icon size="1em" class="fa fa-filter"></converse-icon>
                ${is_filter_visible ? i18n_hide_filter : i18n_show_filter}
            </a>
        `);
    }

    if (api.settings.get("loglevel") === 'debug') {
        const i18n_title_sync_contacts = __('Re-sync contacts');
        btns.push(html`
            <a
                href="#"
                class="dropdown-item" role="button"
                @click="${(/** @type {MouseEvent} */ ev) => el.syncContacts(ev)}"
                title="${i18n_title_sync_contacts}"
            >
                <converse-icon class="fa fa-sync sync-contacts" size="1em"></converse-icon>
                ${i18n_title_sync_contacts}
            </a>
        `);
    }

    return html`
        <div class="d-flex controlbox-padded">
            <span class="w-100 controlbox-heading controlbox-heading--contacts">
                <a class="list-toggle open-contacts-toggle" title="${i18n_toggle_contacts}"
                    role="heading" aria-level="3"
                    @click="${el.toggleRoster}">
                    ${i18n_heading_contacts}

                    ${ roster.length ? html`<converse-icon
                        class="fa ${is_closed ? 'fa-caret-right' : 'fa-caret-down'}"
                        size="1em"
                        color="var(--chat-color)"
                        ></converse-icon>` : '' }
                </a>
            </span>
            <converse-dropdown
                class="chatbox-btn btn-group dropstart dropdown--contacts"
                .items=${btns}></converse-dropdown>
        </div>

        <div class="list-container roster-contacts ${is_closed ? 'hidden' : ''}">
            ${is_filter_visible
                ? html`<converse-list-filter
                      @update=${() => el.requestUpdate()}
                      .promise=${api.waitUntil('rosterInitialized')}
                      .items=${_converse.state.roster}
                      .template=${tplRosterFilter}
                      .model=${_converse.state.roster_filter}
                  ></converse-list-filter>`
                : ''}
            ${repeat(
                groupnames,
                (n) => n,
                (name) => {
                    const contacts = contacts_map[name].filter((c) => shouldShowContact(c, name, el.model));
                    contacts.sort(contactsComparator);
                    return contacts.length ? tplGroup({ contacts, name }) : '';
                }
            )}
        </div>
    `;
};
