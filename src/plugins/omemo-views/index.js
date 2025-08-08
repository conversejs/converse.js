/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @module plugins-omemo-index
 */
import { _converse, api, converse, log } from '@converse/headless';
import './fingerprints.js';
import './profile.js';
import 'shared/modals/user-details.js';
import {
    generateFingerprints,
    getOMEMOToolbarButton,
    handleEncryptedFiles,
    onChatComponentInitialized,
} from './utils.js';

import './styles/omemo.scss';

converse.plugins.add('converse-omemo-views', {
    /**
     * @param {import('@converse/headless/types/shared/_converse.d.js').ConversePrivateGlobal} _converse
     */
    enabled(_converse) {
        const plugins = _converse.pluggable.plugins;
        return plugins['converse-bosh']?.enabled();
    },

    dependencies: ['converse-chatview', 'converse-omemo'],

    initialize() {
        api.listen.on('chatBoxViewInitialized', onChatComponentInitialized);
        api.listen.on('chatRoomViewInitialized', onChatComponentInitialized);
        api.listen.on('getToolbarButtons', getOMEMOToolbarButton);
        api.listen.on('afterMessageBodyTransformed', handleEncryptedFiles);

        api.listen.on('userDetailsModalInitialized', (contact) => {
            const jid = contact.get('jid');
            generateFingerprints(jid).catch((e) => log.error(e));
        });

        api.listen.on('profileModalInitialized', () => {
            const bare_jid = _converse.session.get('bare_jid');
            generateFingerprints(bare_jid).catch((e) => log.error(e));
        });
    },
});
