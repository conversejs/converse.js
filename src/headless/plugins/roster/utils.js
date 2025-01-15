/**
 * @typedef {import('./contacts').default} RosterContacts
 */
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import log from "../../log.js";
import { Model } from '@converse/skeletor';
import { RosterFilter } from '../../plugins/roster/filter.js';
import { PRIVATE_CHAT_TYPE } from "../../shared/constants";
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
     * Triggered once the `RosterContacts`
     * been created, but not yet populated with data.
     * This event is useful when you want to create views for these collections.
     * @event _converse#chatBoxMaximized
     * @example _converse.api.listen.on('rosterInitialized', () => { ... });
     * @example _converse.api.waitUntil('rosterInitialized').then(() => { ... });
     */
    api.trigger('rosterInitialized', roster);
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
    const roster = /** @type {RosterContacts} */(_converse.state.roster);
    try {
        await roster.fetchRosterContacts();
        api.trigger('rosterContactsFetched', roster);
    } catch (reason) {
        log.error(reason);
    } finally {
        connection.send_initial_presence && api.user.presence.send();
    }
}


function updateUnreadCounter (chatbox) {
    const roster = /** @type {RosterContacts} */(_converse.state.roster);
    const contact = roster?.get(chatbox.get('jid'));
    contact?.save({'num_unread': chatbox.get('num_unread')});
}

let presence_ref;

function registerPresenceHandler () {
    unregisterPresenceHandler();
    const connection = api.connection.get();
    presence_ref = connection.addHandler(presence => {
            const roster = /** @type {RosterContacts} */(_converse.state.roster);
            roster.presenceHandler(presence);
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
    if (shouldClearCache(_converse)) {
        const roster = /** @type {RosterContacts} */(_converse.state.roster);
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
 * @param {Boolean} reconnecting
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
    const roster = /** @type {RosterContacts} */(_converse.state.roster);
    roster.onConnected();
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
            chatbox.setModelContact(chatbox.get('jid'));
        }
    });
}


/**
 * Roster specific handler for the rosterContactsFetched promise
 */
export function onRosterContactsFetched () {
    const roster = /** @type {RosterContacts} */(_converse.state.roster);
    roster.on('add', contact => {
        // When a new contact is added, check if we already have a
        // chatbox open for it, and if so attach it to the chatbox.
        const chatbox = _converse.state.chatboxes.findWhere({ 'jid': contact.get('jid') });
        chatbox?.setModelContact(contact.get('jid'));
    });
}

/**
 * Reject or cancel another user's subscription to our presence updates.
 * @function rejectPresenceSubscription
 * @param {String} jid - The Jabber ID of the user whose subscription is being canceled
 * @param {String} message - An optional message to the user
 */
export function rejectPresenceSubscription (jid, message) {
    const pres = $pres({to: jid, type: "unsubscribed"});
    if (message && message !== "") { pres.c("status").t(message); }
    api.send(pres);
}
