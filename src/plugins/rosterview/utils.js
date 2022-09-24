import log from "@converse/headless/log";
import { __ } from 'i18n';
import { _converse, api } from "@converse/headless/core";

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
    _converse.roster?.get(chatbox.get('jid'))?.trigger('highlight');
}

export function toggleGroup (ev, name) {
    ev?.preventDefault?.();
    const collapsed = _converse.roster.state.get('collapsed_groups');
    if (collapsed.includes(name)) {
        _converse.roster.state.save('collapsed_groups', collapsed.filter(n => n !== name));
    } else {
        _converse.roster.state.save('collapsed_groups', [...collapsed, name]);
    }
}

export function isContactFiltered (contact, groupname) {
    const filter = _converse.roster_filter;
    const type = filter.get('filter_type');
    const q = (type === 'state') ?
        filter.get('chat_state').toLowerCase() :
        filter.get('filter_text').toLowerCase();

    if (!q) return false;

    if (type === 'state') {
        const sticky_groups = [_converse.HEADER_REQUESTING_CONTACTS, _converse.HEADER_UNREAD];
        if (sticky_groups.includes(groupname)) {
            // When filtering by chat state, we still want to
            // show sticky groups, even though they don't
            // match the state in question.
            return false;
        } else if (q === 'unread_messages') {
            return contact.get('num_unread') === 0;
        } else if (q === 'online') {
            return ["offline", "unavailable"].includes(contact.presence.get('show'));
        } else {
            return !contact.presence.get('show').includes(q);
        }
    } else if (type === 'contacts')  {
        return !contact.getFilterCriteria().includes(q);
    }
}

export function shouldShowContact (contact, groupname) {
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

export function shouldShowGroup (group) {
    const filter = _converse.roster_filter;
    const type = filter.get('filter_type');
    if (type === 'groups') {
        const q = filter.get('filter_text')?.toLowerCase();
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
        const name = _converse.HEADER_REQUESTING_CONTACTS;
        contacts_map[name] ? contacts_map[name].push(contact) : (contacts_map[name] = [contact]);
    } else {
        let contact_groups;
        if (api.settings.get('roster_groups')) {
            contact_groups = contact.get('groups');
            contact_groups = (contact_groups.length === 0) ? [_converse.HEADER_UNGROUPED] : contact_groups;
        } else {
            if (contact.get('ask') === 'subscribe') {
                contact_groups = [_converse.HEADER_PENDING_CONTACTS];
            } else {
                contact_groups = [_converse.HEADER_CURRENT_CONTACTS];
            }
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
