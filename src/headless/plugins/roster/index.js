/**
 * @module converse-roster
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "@converse/headless/plugins/status";
import RosterContact from './contact.js';
import RosterContacts from './contacts.js';
import invoke from 'lodash/invoke';
import log from "@converse/headless/log";
import roster_api from './api.js';
import { Presence, Presences } from './presence.js';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";
import { clearPresences, initRoster, updateUnreadCounter } from './utils.js';

const { $pres } = converse.env;


converse.plugins.add('converse-roster', {

    dependencies: ['converse-status'],

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        api.settings.extend({
            'allow_contact_requests': true,
            'auto_subscribe': false,
            'synchronize_availability': true,
        });

        api.promises.add([
            'cachedRoster',
            'roster',
            'rosterContactsFetched',
            'rosterInitialized',
        ]);

        // API methods only available to plugins
        Object.assign(_converse.api, roster_api);

        _converse.HEADER_CURRENT_CONTACTS =  __('My contacts');
        _converse.HEADER_PENDING_CONTACTS = __('Pending contacts');
        _converse.HEADER_REQUESTING_CONTACTS = __('Contact requests');
        _converse.HEADER_UNGROUPED = __('Ungrouped');
        _converse.HEADER_UNREAD = __('New messages');


        _converse.registerPresenceHandler = function () {
            _converse.unregisterPresenceHandler();
            _converse.presence_ref = _converse.connection.addHandler(presence => {
                    _converse.roster.presenceHandler(presence);
                    return true;
                }, null, 'presence', null);
        };


        /**
         * Reject or cancel another user's subscription to our presence updates.
         * @method rejectPresenceSubscription
         * @private
         * @memberOf _converse
         * @param { String } jid - The Jabber ID of the user whose subscription is being canceled
         * @param { String } message - An optional message to the user
         */
        _converse.rejectPresenceSubscription = function (jid, message) {
            const pres = $pres({to: jid, type: "unsubscribed"});
            if (message && message !== "") { pres.c("status").t(message); }
            api.send(pres);
        };


        _converse.sendInitialPresence = function () {
            if (_converse.send_initial_presence) {
                api.user.presence.send();
            }
        };


        /**
         * Fetch all the roster groups, and then the roster contacts.
         * Emit an event after fetching is done in each case.
         * @private
         * @method _converse.populateRoster
         * @param { Bool } ignore_cache - If set to to true, the local cache
         *      will be ignored it's guaranteed that the XMPP server
         *      will be queried for the roster.
         */
        _converse.populateRoster = async function (ignore_cache=false) {
            if (ignore_cache) {
                _converse.send_initial_presence = true;
            }
            try {
                await _converse.roster.fetchRosterContacts();
                api.trigger('rosterContactsFetched');
            } catch (reason) {
                log.error(reason);
            } finally {
                _converse.sendInitialPresence();
            }
        };

        _converse.Presence = Presence;
        _converse.Presences = Presences;
        _converse.RosterContact = RosterContact;
        _converse.RosterContacts = RosterContacts;

        _converse.unregisterPresenceHandler = function () {
            if (_converse.presence_ref !== undefined) {
                _converse.connection.deleteHandler(_converse.presence_ref);
                delete _converse.presence_ref;
            }
        };


        /******************** Event Handlers ********************/
        api.listen.on('chatBoxesInitialized', () => {
            _converse.chatboxes.on('change:num_unread', updateUnreadCounter);

            _converse.chatboxes.on('add', chatbox => {
                if (chatbox.get('type') === _converse.PRIVATE_CHAT_TYPE) {
                    chatbox.setRosterContact(chatbox.get('jid'));
                }
            });
        });

        api.listen.on('beforeTearDown', () => _converse.unregisterPresenceHandler());

        api.waitUntil('rosterContactsFetched').then(() => {
            _converse.roster.on('add', (contact) => {
                /* When a new contact is added, check if we already have a
                 * chatbox open for it, and if so attach it to the chatbox.
                 */
                const chatbox = _converse.chatboxes.findWhere({'jid': contact.get('jid')});
                if (chatbox) {
                    chatbox.setRosterContact(contact.get('jid'));
                }
            });
        });


        api.listen.on('streamResumptionFailed', () => _converse.session.set('roster_cached', false));

        api.listen.on('clearSession', async () => {
            await clearPresences();
            if (_converse.shouldClearCache()) {
                if (_converse.rostergroups) {
                    await _converse.rostergroups.clearStore();
                    delete _converse.rostergroups;
                }
                if (_converse.roster) {
                    invoke(_converse, 'roster.data.destroy');
                    await _converse.roster.clearStore();
                    delete _converse.roster;
                }
            }
        });


        api.listen.on('statusInitialized', async reconnecting => {
            if (reconnecting) {
                // When reconnecting and not resuming a previous session,
                // we clear all cached presence data, since it might be stale
                // and we'll receive new presence updates
                !_converse.connection.hasResumed() && await clearPresences();
            } else {
                _converse.presences = new _converse.Presences();
                const id = `converse.presences-${_converse.bare_jid}`;
                _converse.presences.browserStorage = _converse.createStore(id, "session");
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
        });


        api.listen.on('presencesInitialized', async (reconnecting) => {
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
                await initRoster();
            }
            _converse.roster.onConnected();
            _converse.registerPresenceHandler();
            _converse.populateRoster(!_converse.connection.restored);
        });
    }
});
