/**
 * @typedef {import('@converse/skeletor').Model} Model
 * @typedef {import('@converse/headless').RosterContact} RosterContact
 * @typedef {import('@converse/headless').RosterContacts} RosterContacts
 */
import { __ } from 'i18n';
import { _converse, api, converse, log, constants } from "@converse/headless";

const { Strophe } = converse.env;
const { STATUS_WEIGHTS } = constants;

/**
 * @param {RosterContact} contact
 */
export async function removeContact (contact) {
    try {
        await contact.sendRosterRemoveStanza();
    } catch (e) {
        log.error(e);
        api.alert('error', __('Error'), [
            __('Sorry, there was an error while trying to remove %1$s as a contact.',
            contact.getDisplayName())
        ]);
    } finally {
        contact.destroy();
    }
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

/**
 * @param {import('./types').ContactsMap} contacts_map
 * @param {RosterContact} contact
 * @returns {import('./types').ContactsMap}
 */
export function populateContactsMap (contacts_map, contact) {
    const { labels } = _converse;
    let contact_groups;
    if (contact.get('requesting')) {
        contact_groups = [labels.HEADER_REQUESTING_CONTACTS];
    } else if (contact.get('ask') === 'subscribe') {
        contact_groups = [labels.HEADER_PENDING_CONTACTS];
    } else if (contact.get('subscription') === 'none') {
        contact_groups = [labels.HEADER_UNSAVED_CONTACTS];
    } else if (!api.settings.get('roster_groups')) {
        contact_groups = [labels.HEADER_CURRENT_CONTACTS];
    } else {
        contact_groups = contact.get('groups');
        contact_groups = (contact_groups.length === 0) ? [labels.HEADER_UNGROUPED] : contact_groups;
    }

    for (const name of contact_groups) {
        contacts_map[name] ? contacts_map[name].push(contact) : (contacts_map[name] = [contact]);
    }

    if (contact.get('num_unread')) {
        const name = /** @type {string} */(labels.HEADER_UNREAD);
        contacts_map[name] ? contacts_map[name].push(contact) : (contacts_map[name] = [contact]);
    }
    return contacts_map;
}

/**
 * @param {RosterContact} contact1
 * @param {RosterContact} contact2
 * @returns {(-1|0|1)}
 */
export function contactsComparator (contact1, contact2) {
    const status1 = contact1.presence.get('show') || 'offline';
    const status2 = contact2.presence.get('show') || 'offline';
    if (STATUS_WEIGHTS[status1] === STATUS_WEIGHTS[status2]) {
        const name1 = (contact1.getDisplayName()).toLowerCase();
        const name2 = (contact2.getDisplayName()).toLowerCase();
        return name1 < name2 ? -1 : (name1 > name2? 1 : 0);
    } else  {
        return STATUS_WEIGHTS[status1] < STATUS_WEIGHTS[status2] ? -1 : 1;
    }
}

export function groupsComparator (a, b) {
    const HEADER_WEIGHTS = {};
    const {
        HEADER_UNREAD,
        HEADER_REQUESTING_CONTACTS,
        HEADER_CURRENT_CONTACTS,
        HEADER_UNGROUPED,
        HEADER_PENDING_CONTACTS,
    } = _converse.labels;

    HEADER_WEIGHTS[HEADER_UNREAD] = 0;
    HEADER_WEIGHTS[HEADER_REQUESTING_CONTACTS] = 1;
    HEADER_WEIGHTS[HEADER_CURRENT_CONTACTS]    = 2;
    HEADER_WEIGHTS[HEADER_UNGROUPED]           = 3;
    HEADER_WEIGHTS[HEADER_PENDING_CONTACTS]    = 4;

    const WEIGHTS =  HEADER_WEIGHTS;
    const special_groups = Object.keys(HEADER_WEIGHTS);
    const a_is_special = special_groups.includes(a);
    const b_is_special = special_groups.includes(b);
    if (!a_is_special && !b_is_special ) {
        return a.toLowerCase() < b.toLowerCase() ? -1 : (a.toLowerCase() > b.toLowerCase() ? 1 : 0);
    } else if (a_is_special && b_is_special) {
        return WEIGHTS[a] < WEIGHTS[b] ? -1 : (WEIGHTS[a] > WEIGHTS[b] ? 1 : 0);
    } else if (!a_is_special && b_is_special) {
        const a_header = HEADER_CURRENT_CONTACTS;
        return WEIGHTS[a_header] < WEIGHTS[b] ? -1 : (WEIGHTS[a_header] > WEIGHTS[b] ? 1 : 0);
    } else if (a_is_special && !b_is_special) {
        const b_header = HEADER_CURRENT_CONTACTS;
        return WEIGHTS[a] < WEIGHTS[b_header] ? -1 : (WEIGHTS[a] > WEIGHTS[b_header] ? 1 : 0);
    }
}

export function getGroupsAutoCompleteList () {
    const roster = /** @type {RosterContacts} */(_converse.state.roster);
    const groups = roster.reduce((groups, contact) => groups.concat(contact.get('groups')), []);
    return [...new Set(groups.filter(i => i))];
}

export function getJIDsAutoCompleteList () {
    const roster = /** @type {RosterContacts} */(_converse.state.roster);
    return [...new Set(roster.map(item => Strophe.getDomainFromJid(item.get('jid'))))];
}

/**
 * @param {string} query
 */
export async function getNamesAutoCompleteList (query) {
    const options = {
        'mode': /** @type {RequestMode} */('cors'),
        'headers': {
            'Accept': 'text/json'
        }
    };
    const url = `${api.settings.get('xhr_user_search_url')}q=${encodeURIComponent(query)}`;
    let response;
    try {
        response = await fetch(url, options);
    } catch (e) {
        log.error(`Failed to fetch names for query "${query}"`);
        log.error(e);
        return [];
    }

    const json = response.json;
    if (!Array.isArray(json)) {
        log.error(`Invalid JSON returned"`);
        return [];
    }
    return json.map(i => ({'label': i.fullname || i.jid, 'value': i.jid}));
}
