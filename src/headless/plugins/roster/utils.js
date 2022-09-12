import log from "@converse/headless/log";
import { Model } from '@converse/skeletor/src/model.js';
import { RosterFilter } from '@converse/headless/plugins/roster/filter.js';
import { _converse, api, converse } from "@converse/headless/core";
import { initStorage } from '@converse/headless/utils/storage.js';

const { $pres } = converse.env;


function initRoster () {
    // Initialize the collections that represent the roster contacts and groups
    const roster = _converse.roster = new _converse.RosterContacts();
    let id = `converse.contacts-${_converse.bare_jid}`;
    initStorage(roster, id);

    const filter = _converse.roster_filter = new RosterFilter();
    filter.id = `_converse.rosterfilter-${_converse.bare_jid}`;
    initStorage(filter, filter.id);
    filter.fetch();

    id = `converse-roster-model-${_converse.bare_jid}`;
    roster.data = new Model();
    roster.data.id = id;
    initStorage(roster.data, id);
    roster.data.fetch();
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


/**
 * Fetch all the roster groups, and then the roster contacts.
 * Emit an event after fetching is done in each case.
 * @private
 * @param { Bool } ignore_cache - If set to to true, the local cache
 *      will be ignored it's guaranteed that the XMPP server
 *      will be queried for the roster.
 */
async function populateRoster (ignore_cache=false) {
    if (ignore_cache) {
        _converse.send_initial_presence = true;
    }
    try {
        await _converse.roster.fetchRosterContacts();
        api.trigger('rosterContactsFetched');
    } catch (reason) {
        log.error(reason);
    } finally {
        _converse.send_initial_presence && api.user.presence.send();
    }
}


function updateUnreadCounter (chatbox) {
    const contact = _converse.roster?.get(chatbox.get('jid'));
    contact?.save({'num_unread': chatbox.get('num_unread')});
}

function registerPresenceHandler () {
    unregisterPresenceHandler();
    _converse.presence_ref = _converse.connection.addHandler(presence => {
            _converse.roster.presenceHandler(presence);
            return true;
        }, null, 'presence', null);
}

export function unregisterPresenceHandler () {
    if (_converse.presence_ref !== undefined) {
        _converse.connection.deleteHandler(_converse.presence_ref);
        delete _converse.presence_ref;
    }
}

async function clearPresences () {
    await _converse.presences?.clearStore();
}


/**
 * Roster specific event handler for the clearSession event
 */
export async function onClearSession () {
    await clearPresences();
    if (_converse.shouldClearCache()) {
        if (_converse.rostergroups) {
            await _converse.rostergroups.clearStore();
            delete _converse.rostergroups;
        }
        if (_converse.roster) {
            _converse.roster.data?.destroy();
            await _converse.roster.clearStore();
            delete _converse.roster;
        }
    }
}


/**
 * Roster specific event handler for the presencesInitialized event
 * @param { Boolean } reconnecting
 */
export function onPresencesInitialized (reconnecting) {
    if (reconnecting) {
        /**
         * Similar to `rosterInitialized`, but instead pertaining to reconnection.
         * This event indicates that the roster and its groups are now again
         * available after Converse.js has reconnected.
         * @event _converse#rosterReadyAfterReconnection
         * @example _converse.api.listen.on('rosterReadyAfterReconnection', () => { ... });
         */
        api.trigger('rosterReadyAfterReconnection');
    } else {
        initRoster();
    }
    _converse.roster.onConnected();
    registerPresenceHandler();
    populateRoster(!_converse.connection.restored);
}


/**
 * Roster specific event handler for the statusInitialized event
 * @param { Boolean } reconnecting
 */
export async function onStatusInitialized (reconnecting) {
     if (reconnecting) {
         // When reconnecting and not resuming a previous session,
         // we clear all cached presence data, since it might be stale
         // and we'll receive new presence updates
         !_converse.connection.hasResumed() && (await clearPresences());
     } else {
         _converse.presences = new _converse.Presences();
         const id = `converse.presences-${_converse.bare_jid}`;
         initStorage(_converse.presences, id, 'session');
         // We might be continuing an existing session, so we fetch
         // cached presence data.
         _converse.presences.fetch();
     }
     /**
      * Triggered once the _converse.Presences collection has been
      * initialized and its cached data fetched.
      * Returns a boolean indicating whether this event has fired due to
      * Converse having reconnected.
      * @event _converse#presencesInitialized
      * @type { bool }
      * @example _converse.api.listen.on('presencesInitialized', reconnecting => { ... });
      */
     api.trigger('presencesInitialized', reconnecting);
}


/**
 * Roster specific event handler for the chatBoxesInitialized event
 */
export function onChatBoxesInitialized () {
    _converse.chatboxes.on('change:num_unread', updateUnreadCounter);

    _converse.chatboxes.on('add', chatbox => {
        if (chatbox.get('type') === _converse.PRIVATE_CHAT_TYPE) {
            chatbox.setRosterContact(chatbox.get('jid'));
        }
    });
}


/**
 * Roster specific handler for the rosterContactsFetched promise
 */
export function onRosterContactsFetched () {
    _converse.roster.on('add', contact => {
        // When a new contact is added, check if we already have a
        // chatbox open for it, and if so attach it to the chatbox.
        const chatbox = _converse.chatboxes.findWhere({ 'jid': contact.get('jid') });
        chatbox?.setRosterContact(contact.get('jid'));
    });
}

/**
 * Reject or cancel another user's subscription to our presence updates.
 * @function rejectPresenceSubscription
 * @param { String } jid - The Jabber ID of the user whose subscription is being canceled
 * @param { String } message - An optional message to the user
 */
export function rejectPresenceSubscription (jid, message) {
    const pres = $pres({to: jid, type: "unsubscribed"});
    if (message && message !== "") { pres.c("status").t(message); }
    api.send(pres);
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

export function getGroupsAutoCompleteList () {
    const { roster } = _converse;
    const groups = roster.reduce((groups, contact) => groups.concat(contact.get('groups')), []);
    return [...new Set(groups.filter(i => i))];
}
