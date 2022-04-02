/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import '@converse/headless/plugins/status';
import RosterContact from './contact.js';
import RosterContacts from './contacts.js';
import roster_api from './api.js';
import { Presence, Presences } from './presence.js';
import { _converse, api, converse } from '@converse/headless/core';
import {
    onChatBoxesInitialized,
    onClearSession,
    onPresencesInitialized,
    onRosterContactsFetched,
    onStatusInitialized,
    unregisterPresenceHandler,
} from './utils.js';


converse.plugins.add('converse-roster', {
    dependencies: ['converse-status'],

    initialize () {
        api.settings.extend({
            'allow_contact_requests': true,
            'auto_subscribe': false,
            'synchronize_availability': true
        });

        api.promises.add(['cachedRoster', 'roster', 'rosterContactsFetched', 'rosterInitialized']);

        // API methods only available to plugins
        Object.assign(_converse.api, roster_api);

        const { __ } = _converse;
        _converse.HEADER_CURRENT_CONTACTS = __('My contacts');
        _converse.HEADER_PENDING_CONTACTS = __('Pending contacts');
        _converse.HEADER_REQUESTING_CONTACTS = __('Contact requests');
        _converse.HEADER_UNGROUPED = __('Ungrouped');
        _converse.HEADER_UNREAD = __('New messages');

        _converse.Presence = Presence;
        _converse.Presences = Presences;
        _converse.RosterContact = RosterContact;
        _converse.RosterContacts = RosterContacts;

        api.listen.on('beforeTearDown', () => unregisterPresenceHandler());
        api.listen.on('chatBoxesInitialized', onChatBoxesInitialized);
        api.listen.on('clearSession', onClearSession);
        api.listen.on('presencesInitialized', onPresencesInitialized);
        api.listen.on('statusInitialized', onStatusInitialized);
        api.listen.on('streamResumptionFailed', () => _converse.session.set('roster_cached', false));

        api.waitUntil('rosterContactsFetched').then(onRosterContactsFetched);
    }
});
