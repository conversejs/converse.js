import _converse from '../../shared/_converse.js';
import api, { converse } from '../../shared/api/index.js';
import log from "../../log.js";
import { Strophe } from 'strophe.js';
import { Model } from '@converse/skeletor';
import { RosterFilter } from '../../plugins/roster/filter.js';
import { STATUS_WEIGHTS, PRIVATE_CHAT_TYPE } from "../../shared/constants";
import { initStorage } from '../../utils/storage.js';
import { shouldClearCache } from '../../utils/session.js';

const { $pres } = converse.env;


function initRoster () {
    // Initialize the collections that represent the roster contacts and groups
    const roster = new _converse.exports.RosterContacts();
    Object.assign(_converse, { roster }); // XXX Deprecated
    Object.assign(_converse.state, { roster });

    const bare_jid = _converse.session.get('bare_jid');
    let id = `converse.contacts-${bare_jid}`;
    initStorage(roster, id);

    const roster_filter = new RosterFilter();
    Object.assign(_converse, { roster_filter }); // XXX Deprecated
    Object.assign(_converse.state, { roster_filter });

    roster_filter.id = `_converse.rosterfilter-${bare_jid}`;
    initStorage(roster_filter, roster_filter.id);
    roster_filter.fetch();

    id = `converse-roster-model-${bare_jid}`;
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
 * @param {boolean} ignore_cache - If set to to true, the local cache
 *      will be ignored it's guaranteed that the XMPP server
 *      will be queried for the roster.
 */
async function populateRoster (ignore_cache=false) {
    const connection = api.connection.get();
    if (ignore_cache) {
        connection.send_initial_presence = true;
    }
    try {
        await _converse.state.roster.fetchRosterContacts();
        api.trigger('rosterContactsFetched');
    } catch (reason) {
        log.error(reason);
    } finally {
        connection.send_initial_presence && api.user.presence.send();
    }
}


function updateUnreadCounter (chatbox) {
    const contact = _converse.state.roster?.get(chatbox.get('jid'));
    contact?.save({'num_unread': chatbox.get('num_unread')});
}

let presence_ref;

function registerPresenceHandler () {
    unregisterPresenceHandler();
    const connection = api.connection.get();
    presence_ref = connection.addHandler(presence => {
            _converse.state.roster.presenceHandler(presence);
            return true;
        }, null, 'presence', null);
}

export function unregisterPresenceHandler () {
    if (presence_ref) {
        const connection = api.connection.get();
        connection.deleteHandler(presence_ref);
        presence_ref = null;
    }
}

async function clearPresences () {
    await _converse.state.presences?.clearStore();
}


/**
 * Roster specific event handler for the clearSession event
 */
export async function onClearSession () {
    await clearPresences();
    if (shouldClearCache()) {
        const { roster } = _converse.state;
        if (roster) {
            roster.data?.destroy();
            await roster.clearStore();
            delete _converse.state.roster;
            Object.assign(_converse, { roster: undefined }); // XXX DEPRECATED
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
    _converse.state.roster.onConnected();
    registerPresenceHandler();
    populateRoster(!api.connection.get().restored);
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
         !api.connection.get().hasResumed() && (await clearPresences());
     } else {
         const presences = new _converse.exports.Presences();
         Object.assign(_converse, { presences });
         Object.assign(_converse.state, { presences });

         const bare_jid = _converse.session.get('bare_jid');
         const id = `converse.presences-${bare_jid}`;

         initStorage(presences, id, 'session');
         // We might be continuing an existing session, so we fetch
         // cached presence data.
         presences.fetch();
     }
     /**
      * Triggered once the _converse.Presences collection has been
      * initialized and its cached data fetched.
      * Returns a boolean indicating whether this event has fired due to
      * Converse having reconnected.
      * @event _converse#presencesInitialized
      * @type {boolean}
      * @example _converse.api.listen.on('presencesInitialized', reconnecting => { ... });
      */
     api.trigger('presencesInitialized', reconnecting);
}


/**
 * Roster specific event handler for the chatBoxesInitialized event
 */
export function onChatBoxesInitialized () {
    const { chatboxes } = _converse.state;
    chatboxes.on('change:num_unread', updateUnreadCounter);

    chatboxes.on('add', chatbox => {
        if (chatbox.get('type') === PRIVATE_CHAT_TYPE) {
            chatbox.setRosterContact(chatbox.get('jid'));
        }
    });
}


/**
 * Roster specific handler for the rosterContactsFetched promise
 */
export function onRosterContactsFetched () {
    _converse.state.roster.on('add', contact => {
        // When a new contact is added, check if we already have a
        // chatbox open for it, and if so attach it to the chatbox.
        const chatbox = _converse.state.chatboxes.findWhere({ 'jid': contact.get('jid') });
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
    const { roster } = _converse.state;
    const groups = roster.reduce((groups, contact) => groups.concat(contact.get('groups')), []);
    return [...new Set(groups.filter(i => i))];
}

export function getJIDsAutoCompleteList () {
    return [...new Set(_converse.state.roster.map(item => Strophe.getDomainFromJid(item.get('jid'))))];
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
