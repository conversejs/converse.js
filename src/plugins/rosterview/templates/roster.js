import tpl_group from "./group.js";
import { __ } from 'i18n';
import { _converse, api } from "@converse/headless/core";
import { contactsComparator, groupsComparator } from '@converse/headless/plugins/roster/utils.js';
import { html } from "lit";
import { repeat } from 'lit/directives/repeat.js';
import { shouldShowContact, shouldShowGroup } from '../utils.js';


function populateContactsMap (contacts_map, contact) {
    if (contact.get('ask') === 'subscribe') {
        const name = _converse.HEADER_PENDING_CONTACTS;
        contacts_map[name] ? contacts_map[name].push(contact) : (contacts_map[name] = [contact]);
    } else if (contact.get('requesting')) {
        const name = _converse.HEADER_REQUESTING_CONTACTS;
        contacts_map[name] ? contacts_map[name].push(contact) : (contacts_map[name] = [contact]);
    } else {
        let contact_groups;
        if (api.settings.get('roster_groups')) {
            contact_groups = contact.get('groups');
            contact_groups = (contact_groups.length === 0) ? [_converse.HEADER_UNGROUPED] : contact_groups;
        } else {
            contact_groups = [_converse.HEADER_CURRENT_CONTACTS];
        }
        for (const name of contact_groups) {
            contacts_map[name] ? contacts_map[name].push(contact) : (contacts_map[name] = [contact]);
        }
    }
    if (contact.get('num_unread')) {
        const name = _converse.HEADER_UNREAD;
        contacts_map[name] ? contacts_map[name].push(contact) : (contacts_map[name] = [contact]);
    }
    return contacts_map;
}


export default (el) => {
    const i18n_heading_contacts = __('Contacts');
    const i18n_title_add_contact = __('Add a contact');
    const i18n_title_sync_contacts = __('Re-sync your contacts');
    const roster = _converse.roster || [];
    const contacts_map = roster.reduce((acc, contact) => populateContactsMap(acc, contact), {});
    const groupnames = Object.keys(contacts_map).filter(shouldShowGroup);
    groupnames.sort(groupsComparator);

    return html`
        <div class="d-flex controlbox-padded">
            <span class="w-100 controlbox-heading controlbox-heading--contacts">${i18n_heading_contacts}</span>
            <a class="controlbox-heading__btn sync-contacts" @click=${ev => el.syncContacts(ev)} title="${i18n_title_sync_contacts}">
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
        <converse-roster-filter></converse-roster-filter>
        <div class="list-container roster-contacts">
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
