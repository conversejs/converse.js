/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Converse.js plugin which adds support for XEP-0198: Stream Management
 */
import { api, converse } from '@converse/headless/core.js';
import { enableStreamManagement, initSessionData, sendEnableStanza, onStanzaSent } from './utils.js';

const { Strophe } = converse.env;

Strophe.addNamespace('SM', 'urn:xmpp:sm:3');

converse.plugins.add('converse-smacks', {
    initialize () {
        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        api.settings.extend({
            'enable_smacks': true,
            'smacks_max_unacked_stanzas': 5
        });
        api.listen.on('afterResourceBinding', sendEnableStanza);
        api.listen.on('beforeResourceBinding', enableStreamManagement);
        api.listen.on('send', onStanzaSent);
        api.listen.on('userSessionInitialized', initSessionData);
    }
});
