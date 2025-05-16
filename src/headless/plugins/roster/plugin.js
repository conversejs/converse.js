/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import '../../plugins/status/index.js';
import RosterContact from './contact.js';
import RosterContacts from './contacts.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import roster_api from './api.js';
import Presence from './presence.js';
import Presences from './presences.js';
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
            allow_contact_requests: true,
            auto_subscribe: false,
            enable_roster_versioning: true,
            show_self_in_roster: true,
            synchronize_availability: true
        });

        api.promises.add([
            'cachedRoster',
            'roster',
            'rosterContactsFetched',
            'rosterInitialized',
            'presencesInitialized',
        ]);

        // API methods only available to plugins
        Object.assign(_converse.api, roster_api);

        const { __ } = _converse;
        const labels = {
            HEADER_UNSAVED_CONTACTS: __('Unsaved contacts'),
            HEADER_CURRENT_CONTACTS: __('My contacts'),
            HEADER_REQUESTING_CONTACTS: __('Contact requests'),
            HEADER_UNGROUPED: __('Ungrouped'),
            HEADER_UNREAD: __('New messages'),
        };
        Object.assign(_converse, labels); // XXX DEPRECATED
        Object.assign(_converse.labels, labels);

        const exports = { Presence, Presences, RosterContact, RosterContacts };
        Object.assign(_converse, exports);  // XXX DEPRECATED
        Object.assign(_converse.exports, exports);

        api.listen.on('beforeTearDown', () => unregisterPresenceHandler());
        api.listen.on('chatBoxesInitialized', onChatBoxesInitialized);
        api.listen.on('clearSession', onClearSession);
        api.listen.on('presencesInitialized', onPresencesInitialized);
        api.listen.on('statusInitialized', onStatusInitialized);
        api.listen.on('streamResumptionFailed', () => _converse.session.set('roster_cached', false));

        api.waitUntil('rosterContactsFetched').then(onRosterContactsFetched);
    }
});
