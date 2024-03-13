/**
 * @typedef {import('@converse/skeletor').Model} Model
 * @typedef {import('@converse/headless').RosterContact} RosterContact
 */
import { __ } from 'i18n';
import { _converse, api, log } from "@converse/headless";

export function removeContact (contact) {
    contact.removeFromRoster(
        () => contact.destroy(),
        (e) => {
            e && log.error(e);
            api.alert('error', __('Error'), [
                __('Sorry, there was an error while trying to remove %1$s as a contact.',
                contact.getDisplayName())
            ]);
        }
    );
}

export function highlightRosterItem (chatbox) {
    _converse.state.roster?.get(chatbox.get('jid'))?.trigger('highlight');
}

export function toggleGroup (ev, name) {
    ev?.preventDefault?.();
    const { roster } = _converse.state;
    const collapsed = roster.state.get('collapsed_groups');
    if (collapsed.includes(name)) {
        roster.state.save('collapsed_groups', collapsed.filter(n => n !== name));
    } else {
        roster.state.save('collapsed_groups', [...collapsed, name]);
    }
}

/**
 * @param {RosterContact} contact
 * @param {string} groupname
 * @returns {boolean}
 */
export function isContactFiltered (contact, groupname) {
    const filter = _converse.state.roster_filter;
    const type = filter.get('type');
    const q = (type === 'state') ?
        filter.get('state').toLowerCase() :
        filter.get('text').toLowerCase();

    if (!q) return false;

    if (type === 'state') {
        const sticky_groups = [_converse.labels.HEADER_REQUESTING_CONTACTS, _converse.labels.HEADER_UNREAD];
        if (sticky_groups.includes(groupname)) {
            // When filtering by chat state, we still want to
            // show sticky groups, even though they don't
            // match the state in question.
            return false;
        } else if (q === 'unread_messages') {
            return contact.get('num_unread') === 0;
        } else if (q === 'online') {
            return ["offline", "unavailable", "dnd", "away", "xa"].includes(contact.presence.get('show'));
        } else {
            return !contact.presence.get('show').includes(q);
        }
    } else if (type === 'items')  {
        return !contact.getFilterCriteria().includes(q);
    }
}

/**
 * @param {RosterContact} contact
 * @param {string} groupname
 * @param {Model} model
 * @returns {boolean}
 */
export function shouldShowContact (contact, groupname, model) {
    if (!model.get('filter_visible')) return true;

    const chat_status = contact.presence.get('show');
    if (api.settings.get('hide_offline_users') && chat_status === 'offline') {
        // If pending or requesting, show
        if ((contact.get('ask') === 'subscribe') ||
                (contact.get('subscription') === 'from') ||
                (contact.get('requesting') === true)) {
            return !isContactFiltered(contact, groupname);
        }
        return false;
    }
    return !isContactFiltered(contact, groupname);
}

export function shouldShowGroup (group, model) {
    if (!model.get('filter_visible')) return true;

    const filter = _converse.state.roster_filter;
    const type = filter.get('type');
    if (type === 'groups') {
        const q = filter.get('text')?.toLowerCase();
        if (!q) {
            return true;
        }
        if (!group.toLowerCase().includes(q)) {
            return false;
        }
    }
    return true;
}

export function populateContactsMap (contacts_map, contact) {
    if (contact.get('requesting')) {
        const name = /** @type {string} */(_converse.labels.HEADER_REQUESTING_CONTACTS);
        contacts_map[name] ? contacts_map[name].push(contact) : (contacts_map[name] = [contact]);
    } else {
        let contact_groups;
        if (api.settings.get('roster_groups')) {
            contact_groups = contact.get('groups');
            contact_groups = (contact_groups.length === 0) ? [_converse.labels.HEADER_UNGROUPED] : contact_groups;
        } else {
            if (contact.get('ask') === 'subscribe') {
                contact_groups = [_converse.labels.HEADER_PENDING_CONTACTS];
            } else {
                contact_groups = [_converse.labels.HEADER_CURRENT_CONTACTS];
            }
        }
        for (const name of contact_groups) {
            contacts_map[name] ? contacts_map[name].push(contact) : (contacts_map[name] = [contact]);
        }
    }
    if (contact.get('num_unread')) {
        const name = /** @type {string} */(_converse.labels.HEADER_UNREAD);
        contacts_map[name] ? contacts_map[name].push(contact) : (contacts_map[name] = [contact]);
    }
    return contacts_map;
}
