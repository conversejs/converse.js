/**
 * @typedef {import('@converse/skeletor').Model} Model
 * @typedef {import('@converse/headless').RosterContact} RosterContact
 * @typedef {import('@converse/headless').RosterContacts} RosterContacts
 */
import { __ } from 'i18n';
import { _converse, api, converse, log, constants, u, Profile } from '@converse/headless';

const { Strophe } = converse.env;
const { STATUS_WEIGHTS } = constants;

/**
 * @param {RosterContact} contact
 * @param {boolean} [unauthorize]
 * @returns {Promise<boolean>}
 */
export async function removeContact(contact, unauthorize = false) {
    if (!api.settings.get('allow_contact_removal')) return;

    const result = await api.confirm(__('Confirm'), __('Are you sure you want to remove this contact?'));
    if (!result) return false;

    const chat = await api.chats.get(contact.get('jid'));
    chat?.close();
    try {
        await contact.remove(unauthorize);
    } catch (e) {
        log.error(e);
        api.alert('error', __('Error'), [
            __('Sorry, an error occurred while trying to remove %1$s as a contact', contact.getDisplayName()),
        ]);
    }
    return true;
}

/**
 * @param {RosterContact} contact
 */
export async function declineContactRequest(contact) {
    const domain = _converse.session.get('domain');
    const blocking_supported = await api.disco.supports(Strophe.NS.BLOCKING, domain);

    const result = await api.confirm(
        __('Remove and decline contact request'),
        [__('Are you sure you want to decline the contact request from %1$s?', contact.getDisplayName())],
        blocking_supported
            ? [
                  {
                      label: __('Also block this user from sending you further messages'),
                      name: 'block',
                      type: 'checkbox',
                  },
              ]
            : []
    );

    if (result) {
        const chat = await api.chats.get(contact.get('jid'));
        chat?.close();
        contact.unauthorize();

        if (blocking_supported && Array.isArray(result) && result.find((i) => i.name === 'block')?.value === 'on') {
            api.blocklist.add(contact.get('jid'));
            api.toast.show('declined-and-blocked', {
                type: 'success',
                body: __('Contact request declined and user blocked')
            });
        } else {
            api.toast.show('request-declined', {
                type: 'success',
                body: __('Contact request declined')
            });
        }
        contact.destroy();
    }
    return this;
}

/**
 * @param {RosterContact} contact
 * @returns {Promise<boolean>}
 */
export async function blockContact(contact) {
    const domain = _converse.session.get('domain');
    if (!(await api.disco.supports(Strophe.NS.BLOCKING, domain))) return false;

    const i18n_confirm = __('Do you want to block this contact, so they cannot send you messages?');
    if (!(await api.confirm(i18n_confirm))) return false;

    (await api.chats.get(contact.get('jid')))?.close();

    try {
        await Promise.all([api.blocklist.add(contact.get('jid')), contact.remove(true)]);
    } catch (e) {
        log.error(e);
        api.alert('error', __('Error'), [
            __('Sorry, an error occurred while trying to block %1$s', contact.getDisplayName()),
        ]);
    }
}

/**
 * @param {RosterContact} contact
 * @returns {Promise<boolean>}
 */
export async function unblockContact(contact) {
    const domain = _converse.session.get('domain');
    if (!(await api.disco.supports(Strophe.NS.BLOCKING, domain))) return false;

    const i18n_confirm = __('Do you want to unblock this contact, so they can send you messages?');
    if (!(await api.confirm(i18n_confirm))) return false;

    try {
        await api.blocklist.remove(contact.get('jid'));
    } catch (e) {
        log.error(e);
        api.alert('error', __('Error'), [
            __('Sorry, an error occurred while trying to unblock %1$s', contact.getDisplayName()),
        ]);
    }
}

/**
 * @param {string} jid
 */
export function highlightRosterItem(jid) {
    _converse.state.roster?.get(jid)?.trigger('highlight');
}

/**
 * @param {Event} ev
 * @param {string} name
 */
export function toggleGroup(ev, name) {
    ev?.preventDefault?.();
    const { roster } = _converse.state;
    const collapsed = roster.state.get('collapsed_groups');
    if (collapsed.includes(name)) {
        roster.state.save(
            'collapsed_groups',
            collapsed.filter((n) => n !== name)
        );
    } else {
        roster.state.save('collapsed_groups', [...collapsed, name]);
    }
}

/**
 * Return a string of tab-separated values that are to be used when
 * matching against filter text.
 *
 * The goal is to be able to filter against the VCard fullname,
 * roster nickname and JID.
 * @param {RosterContact|Profile} contact
 * @returns {string} Lower-cased, tab-separated values
 */
function getFilterCriteria(contact) {
    const nick = contact instanceof Profile ? contact.getNickname() : contact.get('nickname');
    const jid = contact.get('jid');
    let criteria = contact.getDisplayName({ context: 'roster' });
    criteria = !criteria.includes(jid) ? criteria.concat(`   ${jid}`) : criteria;
    criteria = !criteria.includes(nick) ? criteria.concat(`   ${nick}`) : criteria;
    return criteria.toLowerCase();
}

/**
 * @param {RosterContact|Profile} contact
 * @param {string} groupname
 * @returns {boolean}
 */
export function isContactFiltered(contact, groupname) {
    const filter = _converse.state.roster_filter;
    const type = filter.get('type');
    const q = type === 'state' ? filter.get('state').toLowerCase() : filter.get('text').toLowerCase();

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
            return ['offline', 'unavailable', 'dnd', 'away', 'xa'].includes(contact.getStatus());
        } else {
            return !contact.getStatus().includes(q);
        }
    } else if (type === 'items') {
        return !getFilterCriteria(contact).includes(q);
    }
}

/**
 * @param {RosterContact} contact
 * @param {string} groupname
 * @param {Model} model
 * @returns {boolean}
 */
export function shouldShowContact(contact, groupname, model) {
    if (!model.get('filter_visible')) return true;

    const chat_status = contact.getStatus();
    if (api.settings.get('hide_offline_users') && chat_status === 'offline') {
        // If pending or requesting, show
        if (
            contact.get('ask') === 'subscribe' ||
            contact.get('subscription') === 'from' ||
            contact.get('requesting') === true
        ) {
            return !isContactFiltered(contact, groupname);
        }
        return false;
    }
    return !isContactFiltered(contact, groupname);
}

/**
 * @param {string} group
 * @param {Model} model
 */
export function shouldShowGroup(group, model) {
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
 * Populates a contacts map with the given contact, categorizing it into appropriate groups.
 * @param {import('./types').ContactsMap} contacts_map
 * @param {RosterContact} contact
 * @returns {import('./types').ContactsMap}
 */
export function populateContactsMap(contacts_map, contact) {
    const { labels } = _converse;
    const contact_groups = /** @type {string[]} */ (u.unique(contact.get('groups') ?? []));

    if (u.isOwnJID(contact.get('jid')) && !contact_groups.length) {
        contact_groups.push(/** @type {string} */ (labels.HEADER_UNGROUPED));
    } else if (contact.get('requesting')) {
        contact_groups.push(/** @type {string} */ (labels.HEADER_REQUESTING_CONTACTS));
    } else if (contact.get('subscription') === undefined) {
        contact_groups.push(/** @type {string} */ (labels.HEADER_UNSAVED_CONTACTS));
    } else if (!api.settings.get('roster_groups')) {
        contact_groups.push(/** @type {string} */ (labels.HEADER_CURRENT_CONTACTS));
    } else if (!contact_groups.length) {
        contact_groups.push(/** @type {string} */ (labels.HEADER_UNGROUPED));
    }

    for (const name of contact_groups) {
        if (contacts_map[name]?.includes(contact)) {
            continue;
        }
        contacts_map[name] ? contacts_map[name].push(contact) : (contacts_map[name] = [contact]);
    }

    if (contact.get('num_unread')) {
        const name = /** @type {string} */ (labels.HEADER_UNREAD);
        contacts_map[name] ? contacts_map[name].push(contact) : (contacts_map[name] = [contact]);
    }
    return contacts_map;
}

/**
 * @param {RosterContact|Profile} contact1
 * @param {RosterContact|Profile} contact2
 * @returns {(-1|0|1)}
 */
export function contactsComparator(contact1, contact2) {
    const status1 = contact1.getStatus();
    const status2 = contact2.getStatus();
    if (STATUS_WEIGHTS[status1] === STATUS_WEIGHTS[status2]) {
        const name1 = contact1.getDisplayName().toLowerCase();
        const name2 = contact2.getDisplayName().toLowerCase();
        return name1 < name2 ? -1 : name1 > name2 ? 1 : 0;
    } else {
        return STATUS_WEIGHTS[status1] < STATUS_WEIGHTS[status2] ? -1 : 1;
    }
}

/**
 * @param {string} a
 * @param {string} b
 */
export function groupsComparator(a, b) {
    const HEADER_WEIGHTS = {};
    const {
        HEADER_CURRENT_CONTACTS,
        HEADER_REQUESTING_CONTACTS,
        HEADER_UNGROUPED,
        HEADER_UNREAD,
        HEADER_UNSAVED_CONTACTS,
    } = _converse.labels;

    HEADER_WEIGHTS[HEADER_UNREAD] = 0;
    HEADER_WEIGHTS[HEADER_UNSAVED_CONTACTS] = 1;
    HEADER_WEIGHTS[HEADER_REQUESTING_CONTACTS] = 2;
    HEADER_WEIGHTS[HEADER_CURRENT_CONTACTS] = 3;
    HEADER_WEIGHTS[HEADER_UNGROUPED] = 4;

    const WEIGHTS = HEADER_WEIGHTS;
    const special_groups = Object.keys(HEADER_WEIGHTS);
    const a_is_special = special_groups.includes(a);
    const b_is_special = special_groups.includes(b);
    if (!a_is_special && !b_is_special) {
        return a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0;
    } else if (a_is_special && b_is_special) {
        return WEIGHTS[a] < WEIGHTS[b] ? -1 : WEIGHTS[a] > WEIGHTS[b] ? 1 : 0;
    } else if (!a_is_special && b_is_special) {
        const a_header = HEADER_CURRENT_CONTACTS;
        return WEIGHTS[a_header] < WEIGHTS[b] ? -1 : WEIGHTS[a_header] > WEIGHTS[b] ? 1 : 0;
    } else if (a_is_special && !b_is_special) {
        const b_header = HEADER_CURRENT_CONTACTS;
        return WEIGHTS[a] < WEIGHTS[b_header] ? -1 : WEIGHTS[a] > WEIGHTS[b_header] ? 1 : 0;
    }
}

export function getGroupsAutoCompleteList() {
    const roster = /** @type {RosterContacts} */ (_converse.state.roster);
    const groups = roster.reduce((groups, contact) => groups.concat(contact.get('groups')), []);
    return [...new Set(groups.filter((i) => i))];
}

export function getJIDsAutoCompleteList() {
    const roster = /** @type {RosterContacts} */ (_converse.state.roster);
    return [...new Set(roster.map((item) => Strophe.getDomainFromJid(item.get('jid'))))];
}

/**
 * @param {string} query
 */
export async function getNamesAutoCompleteList(query) {
    const options = {
        mode: /** @type {RequestMode} */ ('cors'),
        headers: {
            Accept: 'text/json',
        },
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

    const json = await response.json();
    if (!Array.isArray(json)) {
        log.error(`Invalid JSON returned"`);
        return [];
    }
    return json.map((i) => ({
        label: `${i.fullname} <${i.jid}>`,
        value: `${i.fullname} <${i.jid}>`,
    }));
}
