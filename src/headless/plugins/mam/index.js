/**
 * @description XEP-0313 Message Archive Management
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import mam_api from './api.js';
import '../disco/index.js';
import {
    onMAMError,
    onMAMPreferences,
    getMAMPrefsFromFeature,
    preMUCJoinMAMFetch,
    fetchNewestMessages,
    handleMAMResult
} from './utils.js';
import { _converse, api, converse } from '@converse/headless/core';

const { Strophe } = converse.env;
const { NS } = Strophe;

converse.plugins.add('converse-mam', {
    dependencies: ['converse-disco', 'converse-muc'],

    initialize () {
        api.settings.extend({
            archived_messages_page_size: '50',
            mam_request_all_pages: true,
            message_archiving: undefined, // Supported values are 'always', 'never', 'roster' (https://xmpp.org/extensions/xep-0313.html#prefs)
            message_archiving_timeout: 20000 // Time (in milliseconds) to wait before aborting MAM request
        });

        Object.assign(api, mam_api);
        // This is mainly done to aid with tests
        Object.assign(_converse, { onMAMError, onMAMPreferences, handleMAMResult });

        /************************ Event Handlers ************************/
        api.listen.on('addClientFeatures', () => api.disco.own.features.add(NS.MAM));
        api.listen.on('serviceDiscovered', getMAMPrefsFromFeature);
        api.listen.on('chatRoomViewInitialized', view => {
            if (api.settings.get('muc_show_logs_before_join')) {
                preMUCJoinMAMFetch(view.model);
                // If we want to show MAM logs before entering the MUC, we need
                // to be informed once it's clear that this MUC supports MAM.
                view.model.features.on('change:mam_enabled', () => preMUCJoinMAMFetch(view.model));
            }
        });
        api.listen.on('enteredNewRoom', muc => muc.features.get('mam_enabled') && fetchNewestMessages(muc));

        api.listen.on('chatReconnected', chat => {
            // XXX: For MUCs, we listen to enteredNewRoom instead
            if (chat.get('type') === _converse.PRIVATE_CHAT_TYPE) {
                fetchNewestMessages(chat);
            }
        });

        api.listen.on('afterMessagesFetched', chat => {
            // XXX: We don't want to query MAM every time this is triggered
            // since it's not necessary when the chat is restored from cache.
            // (given that BOSH or SMACKS will ensure that you get messages
            // sent during the reload).
            // With MUCs we can listen for `enteredNewRoom`.
            if (chat.get('type') === _converse.PRIVATE_CHAT_TYPE && !_converse.connection.restored) {
                fetchNewestMessages(chat);
            }
        });
    }
});
