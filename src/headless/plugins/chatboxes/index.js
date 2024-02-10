/**
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "../emoji/index.js";
import ChatBoxes from './chatboxes.js';
import _converse from '../../shared/_converse.js';
import api, { converse } from '../../shared/api/index.js';
import chatboxes_api from './api.js';

const { Strophe } = converse.env;


converse.plugins.add('converse-chatboxes', {

    dependencies: ["converse-emoji", "converse-roster", "converse-vcard"],

    initialize () {

        api.promises.add([
            'chatBoxesFetched',
            'chatBoxesInitialized',
            'privateChatsAutoJoined'
        ]);

        Object.assign(api, { chatboxes: chatboxes_api});

        Object.assign(_converse, { ChatBoxes }); // TODO: DEPRECATED
        Object.assign(_converse.exports, { ChatBoxes });

        api.listen.on('addClientFeatures', () => {
            api.disco.own.features.add(Strophe.NS.MESSAGE_CORRECT);
            api.disco.own.features.add(Strophe.NS.HTTPUPLOAD);
            api.disco.own.features.add(Strophe.NS.OUTOFBAND);
        });

        let chatboxes;

        api.listen.on('pluginsInitialized', () => {
            chatboxes = new _converse.exports.ChatBoxes();
            Object.assign(_converse, { chatboxes }); // TODO: DEPRECATED
            Object.assign(_converse.state, { chatboxes });

            /**
             * Triggered once the _converse.ChatBoxes collection has been initialized.
             * @event _converse#chatBoxesInitialized
             * @example _converse.api.listen.on('chatBoxesInitialized', () => { ... });
             * @example _converse.api.waitUntil('chatBoxesInitialized').then(() => { ... });
             */
            api.trigger('chatBoxesInitialized');
        });

        api.listen.on('presencesInitialized', (reconnecting) => chatboxes.onConnected(reconnecting));
        api.listen.on('reconnected', () => chatboxes.forEach(m => m.onReconnection()));
    }
});
