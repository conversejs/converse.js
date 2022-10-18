import tpl_group from "./group.js";
import { __ } from 'i18n';
import { _converse, api } from "@converse/headless/core";
import { contactsComparator, groupsComparator } from '@converse/headless/plugins/roster/utils.js';
import { html } from "lit";
import { repeat } from 'lit/directives/repeat.js';
import { shouldShowContact, shouldShowGroup, populateContactsMap } from '../utils.js';


export default (el) => {
    const i18n_heading_contacts = __('Contacts');
    const i18n_toggle_contacts = __('Click to toggle contacts');
    const i18n_title_add_contact = __('Add a contact');
    const i18n_title_sync_contacts = __('Re-sync your contacts');
    const roster = _converse.roster || [];
    const contacts_map = roster.reduce((acc, contact) => populateContactsMap(acc, contact), {});
    const groupnames = Object.keys(contacts_map).filter(shouldShowGroup);
    const is_closed = el.model.get('toggle_state') === _converse.CLOSED;
    groupnames.sort(groupsComparator);

    return html`
        <div class="d-flex controlbox-padded">
            <span class="w-100 controlbox-heading controlbox-heading--contacts">
                <a class="list-toggle open-contacts-toggle" title="${i18n_toggle_contacts}" @click=${el.toggleRoster}>
                    <converse-icon
                        class="fa ${ is_closed ? 'fa-caret-right' : 'fa-caret-down' }"
                        size="1em"
                        color="var(--chat-color)"></converse-icon>
                    ${i18n_heading_contacts}
                </a>
            </span>
            <a class="controlbox-heading__btn sync-contacts"
               @click=${ev => el.syncContacts(ev)}
               title="${i18n_title_sync_contacts}">

                <converse-icon class="fa fa-sync right ${el.syncing_contacts ? 'fa-spin' : ''}" size="1em"></converse-icon>
            </a>
            ${ api.settings.get('allow_contact_requests') ? html`
                <a class="controlbox-heading__btn add-contact"
                    @click=${ev => el.showAddContactModal(ev)}
                    title="${i18n_title_add_contact}"
                    data-toggle="modal"
                    data-target="#add-contact-modal">
                    <converse-icon class="fa fa-user-plus right" size="1.25em"></converse-icon>
                </a>` : '' }
        </div>
        <div class="list-container roster-contacts ${ is_closed ? 'hidden' : '' }">
            <converse-roster-filter @update=${() => el.requestUpdate()}></converse-roster-filter>
            ${ repeat(groupnames, n => n, name => {
                const contacts = contacts_map[name].filter(c => shouldShowContact(c, name));
                contacts.sort(contactsComparator);
                if (contacts.length) {
                    return tpl_group({
                        'contacts': contacts,
                        'name': name,
                    });
                } else {
                    return '';
                }
            }) }
        </div>
    `;
}
