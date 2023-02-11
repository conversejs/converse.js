/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import './fingerprints.js';
import './profile.js';
import 'shared/modals/user-details.js';
import log from '@converse/headless/log';
import { _converse, api, converse } from '@converse/headless/core';
import {
    getOMEMOToolbarButton,
    onChatInitialized,
} from './utils.js';

converse.plugins.add('converse-omemo-views', {
    enabled (_converse) {
        return (
            window.libsignal &&
            _converse.config.get('trusted') &&
            !api.settings.get('clear_cache_on_logout') &&
            !_converse.api.settings.get('blacklisted_plugins').includes('converse-omemo-views')
        );
    },

    dependencies: ['converse-chatview', 'converse-pubsub', 'converse-profile', 'converse-omemo'],

    initialize () {
        api.listen.on('chatBoxViewInitialized', onChatInitialized);
        api.listen.on('chatRoomViewInitialized', onChatInitialized);

        api.listen.on('getToolbarButtons', getOMEMOToolbarButton);

        api.listen.on('userDetailsModalInitialized', contact => {
            const jid = contact.get('jid');
            _converse.generateFingerprints(jid).catch(e => log.error(e));
        });

        api.listen.on('profileModalInitialized', () => {
            _converse.generateFingerprints(_converse.bare_jid).catch(e => log.error(e));
        });

        api.listen.on('afterMessageBodyTransformed', handleEncryptedFiles);
    }
});
