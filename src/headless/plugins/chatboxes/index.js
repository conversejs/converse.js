/**
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "../emoji/index.js";
import ChatBoxes from './chatboxes.js';
import chatboxes_api from './api.js';
import { _converse, api, converse } from "../../core.js";

const { Strophe } = converse.env;


converse.plugins.add('converse-chatboxes', {

    dependencies: ["converse-emoji", "converse-roster", "converse-vcard"],

    initialize () {

        api.promises.add([
            'chatBoxesFetched',
            'chatBoxesInitialized',
            'privateChatsAutoJoined'
        ]);

        Object.assign(api, { 'chatboxes': chatboxes_api});

        _converse.ChatBoxes = ChatBoxes;


        api.listen.on('addClientFeatures', () => {
            api.disco.own.features.add(Strophe.NS.MESSAGE_CORRECT);
            api.disco.own.features.add(Strophe.NS.HTTPUPLOAD);
            api.disco.own.features.add(Strophe.NS.OUTOFBAND);
        });

        api.listen.on('pluginsInitialized', () => {
            _converse.chatboxes = new _converse.ChatBoxes();
            /**
             * Triggered once the _converse.ChatBoxes collection has been initialized.
             * @event _converse#chatBoxesInitialized
             * @example _converse.api.listen.on('chatBoxesInitialized', () => { ... });
             * @example _converse.api.waitUntil('chatBoxesInitialized').then(() => { ... });
             */
            api.trigger('chatBoxesInitialized');
        });

        api.listen.on('presencesInitialized', (reconnecting) => _converse.chatboxes.onConnected(reconnecting));
        api.listen.on('reconnected', () => _converse.chatboxes.forEach(m => m.onReconnection()));
    }
});
