/**
 * @module converse-chatboxes
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "./converse-emoji";
import { Collection } from "@converse/skeletor/src/collection";
import { _converse, api, converse } from "./converse-core";
import log from "./log";

const { Strophe } = converse.env;

Strophe.addNamespace('MESSAGE_CORRECT', 'urn:xmpp:message-correct:0');
Strophe.addNamespace('RECEIPTS', 'urn:xmpp:receipts');
Strophe.addNamespace('REFERENCE', 'urn:xmpp:reference:0');
Strophe.addNamespace('MARKERS', 'urn:xmpp:chat-markers:0');


converse.plugins.add('converse-chatboxes', {

    dependencies: ["converse-emoji", "converse-roster", "converse-vcard"],

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */

        api.promises.add([
            'chatBoxesFetched',
            'chatBoxesInitialized',
            'privateChatsAutoJoined'
        ]);

        _converse.ChatBoxes = Collection.extend({
            comparator: 'time_opened',

            model (attrs, options) {
                return new _converse.ChatBox(attrs, options);
            },

            onChatBoxesFetched (collection) {
                collection.filter(c => !c.isValid()).forEach(c => c.destroy());
                /**
                 * Triggered once all chat boxes have been recreated from the browser cache
                 * @event _converse#chatBoxesFetched
                 * @type { object }
                 * @property { _converse.ChatBox | _converse.ChatRoom } chatbox
                 * @property { XMLElement } stanza
                 * @example _converse.api.listen.on('chatBoxesFetched', obj => { ... });
                 * @example _converse.api.waitUntil('chatBoxesFetched').then(() => { ... });
                 */
                api.trigger('chatBoxesFetched');
            },

            onConnected (reconnecting) {
                if (reconnecting) { return; }
                this.browserStorage = _converse.createStore(`converse.chatboxes-${_converse.bare_jid}`);
                this.fetch({
                    'add': true,
                    'success': c => this.onChatBoxesFetched(c)
                });
            }
        });

        async function createChatBox (jid, attrs, Model) {
            jid = Strophe.getBareJidFromJid(jid.toLowerCase());
            Object.assign(attrs, {'jid': jid, 'id': jid});
            let chatbox;
            try {
                chatbox = new Model(attrs, {'collection': _converse.chatboxes});
            } catch (e) {
                log.error(e);
                return null;
            }
            await chatbox.initialized;
            if (!chatbox.isValid()) {
                chatbox.destroy();
                return null;
            }
            _converse.chatboxes.add(chatbox);
            return chatbox;
        }


        /************************ BEGIN Event Handlers ************************/
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
        /************************ END Event Handlers ************************/


        /************************ BEGIN API ************************/
        Object.assign(api, {
            /**
             * The "chatboxes" namespace.
             *
             * @namespace api.chatboxes
             * @memberOf api
             */
            chatboxes: {
                /**
                 * @method api.chats.create
                 * @param { String|String[] } jids - A JID or array of JIDs
                 * @param { Object } [attrs] An object containing configuration attributes
                 * @param { Model } model - The type of chatbox that should be created
                 */
                async create (jids=[], attrs={}, model) {
                    await api.waitUntil('chatBoxesFetched');
                    if (typeof jids === 'string') {
                        return createChatBox(jids, attrs, model);
                    } else {
                        return Promise.all(jids.map(jid => createChatBox(jid, attrs, model)));
                    }
                },

                /**
                 * @method api.chats.get
                 * @param { String|String[] } jids - A JID or array of JIDs
                 */
                async get (jids) {
                    await api.waitUntil('chatBoxesFetched');
                    if (jids === undefined) {
                        return _converse.chatboxes.models;
                    } else if (typeof jids === 'string') {
                        return _converse.chatboxes.get(jids.toLowerCase());
                    } else {
                        jids = jids.map(j => j.toLowerCase());
                        return _converse.chatboxes.models.filter(m => jids.includes(m.get('jid')));
                    }
                }
            }
        });
        /************************ END API ************************/
    }
});
