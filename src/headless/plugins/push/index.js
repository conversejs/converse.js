/**
 * @description
 * Converse.js plugin which add support for registering
 * an "App Server" as defined in  XEP-0357
 * @copyright 2021, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { enablePush, onChatBoxAdded } from './utils.js';

const { Strophe } = converse.env;

Strophe.addNamespace('PUSH', 'urn:xmpp:push:0');

converse.plugins.add('converse-push', {
    initialize() {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        api.settings.extend({
            'push_app_servers': [],
            'enable_muc_push': false,
        });

        api.listen.on('statusInitialized', () => enablePush());

        if (api.settings.get('enable_muc_push')) {
            api.listen.on('chatBoxesInitialized', () => _converse.state.chatboxes.on('add', onChatBoxAdded));
        }
    },
});
