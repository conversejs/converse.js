import { _converse, api } from "@converse/headless/core";
import { Model } from '@converse/skeletor/src/model.js';


export async function initRoster () {
    // Initialize the Bakcbone collections that represent the contats
    // roster and the roster groups.
    await api.waitUntil('VCardsInitialized');
    _converse.roster = new _converse.RosterContacts();
    let id = `converse.contacts-${_converse.bare_jid}`;
    _converse.roster.browserStorage = _converse.createStore(id);

    _converse.roster.data = new Model();
    id = `converse-roster-model-${_converse.bare_jid}`;
    _converse.roster.data.id = id;
    _converse.roster.data.browserStorage = _converse.createStore(id);
    _converse.roster.data.fetch();
    /**
     * Triggered once the `_converse.RosterContacts`
     * been created, but not yet populated with data.
     * This event is useful when you want to create views for these collections.
     * @event _converse#chatBoxMaximized
     * @example _converse.api.listen.on('rosterInitialized', () => { ... });
     * @example _converse.api.waitUntil('rosterInitialized').then(() => { ... });
     */
    api.trigger('rosterInitialized');
}


export function updateUnreadCounter (chatbox) {
    const contact = _converse.roster && _converse.roster.findWhere({'jid': chatbox.get('jid')});
    if (contact !== undefined) {
        contact.save({'num_unread': chatbox.get('num_unread')});
    }
}


export async function clearPresences () {
    await _converse.presences?.clearStore();
}


export function contactsComparator (contact1, contact2) {
    const status1 = contact1.presence.get('show') || 'offline';
    const status2 = contact2.presence.get('show') || 'offline';
    if (_converse.STATUS_WEIGHTS[status1] === _converse.STATUS_WEIGHTS[status2]) {
        const name1 = (contact1.getDisplayName()).toLowerCase();
        const name2 = (contact2.getDisplayName()).toLowerCase();
        return name1 < name2 ? -1 : (name1 > name2? 1 : 0);
    } else  {
        return _converse.STATUS_WEIGHTS[status1] < _converse.STATUS_WEIGHTS[status2] ? -1 : 1;
    }
}


export function groupsComparator (a, b) {
    const HEADER_WEIGHTS = {};
    HEADER_WEIGHTS[_converse.HEADER_UNREAD] = 0;
    HEADER_WEIGHTS[_converse.HEADER_REQUESTING_CONTACTS] = 1;
    HEADER_WEIGHTS[_converse.HEADER_CURRENT_CONTACTS]    = 2;
    HEADER_WEIGHTS[_converse.HEADER_UNGROUPED]           = 3;
    HEADER_WEIGHTS[_converse.HEADER_PENDING_CONTACTS]    = 4;

    const WEIGHTS =  HEADER_WEIGHTS;
    const special_groups = Object.keys(HEADER_WEIGHTS);
    const a_is_special = special_groups.includes(a);
    const b_is_special = special_groups.includes(b);
    if (!a_is_special && !b_is_special ) {
        return a.toLowerCase() < b.toLowerCase() ? -1 : (a.toLowerCase() > b.toLowerCase() ? 1 : 0);
    } else if (a_is_special && b_is_special) {
        return WEIGHTS[a] < WEIGHTS[b] ? -1 : (WEIGHTS[a] > WEIGHTS[b] ? 1 : 0);
    } else if (!a_is_special && b_is_special) {
        const a_header = _converse.HEADER_CURRENT_CONTACTS;
        return WEIGHTS[a_header] < WEIGHTS[b] ? -1 : (WEIGHTS[a_header] > WEIGHTS[b] ? 1 : 0);
    } else if (a_is_special && !b_is_special) {
        const b_header = _converse.HEADER_CURRENT_CONTACTS;
        return WEIGHTS[a] < WEIGHTS[b_header] ? -1 : (WEIGHTS[a] > WEIGHTS[b_header] ? 1 : 0);
    }
}
