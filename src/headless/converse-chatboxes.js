/**
 * @module converse-chatboxes
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "./converse-emoji";
import { Collection } from "skeletor.js/src/collection";
import converse from "./converse-core";
import { isString } from "lodash";
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
        const { _converse } = this;

        _converse.api.promises.add([
            'chatBoxesFetched',
            'chatBoxesInitialized',
            'privateChatsAutoJoined'
        ]);

        let msg_counter = 0;

        _converse.incrementMsgCounter = function () {
            msg_counter += 1;
            const title = document.title;
            if (!title) {
                return;
            }
            if (title.search(/^Messages \(\d+\) /) === -1) {
                document.title = `Messages (${msg_counter}) ${title}`;
            } else {
                document.title = title.replace(/^Messages \(\d+\) /, `Messages (${msg_counter}) `);
            }
        };

        _converse.clearMsgCounter = function () {
            msg_counter = 0;
            const title = document.title;
            if (!title) {
                return;
            }
            if (title.search(/^Messages \(\d+\) /) !== -1) {
                document.title = title.replace(/^Messages \(\d+\) /, "");
            }
        };


        _converse.ChatBoxes = Collection.extend({
            comparator: 'time_opened',

            model (attrs, options) {
                return new _converse.ChatBox(attrs, options);
            },

            onChatBoxesFetched (collection) {
                collection.filter(c => !c.isValid()).forEach(c => c.destroy());
                /**
                 * Triggered when a message stanza is been received and processed.
                 * @event _converse#chatBoxesFetched
                 * @type { object }
                 * @property { _converse.ChatBox | _converse.ChatRoom } chatbox
                 * @property { XMLElement } stanza
                 * @example _converse.api.listen.on('message', obj => { ... });
                 * @example _converse.api.waitUntil('chatBoxesFetched').then(() => { ... });
                 */
                _converse.api.trigger('chatBoxesFetched');
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
            await chatbox.messages.fetched;
            return chatbox;
        }


        /************************ BEGIN Event Handlers ************************/
        _converse.api.listen.on('addClientFeatures', () => {
            _converse.api.disco.own.features.add(Strophe.NS.MESSAGE_CORRECT);
            _converse.api.disco.own.features.add(Strophe.NS.HTTPUPLOAD);
            _converse.api.disco.own.features.add(Strophe.NS.OUTOFBAND);
        });

        _converse.api.listen.on('pluginsInitialized', () => {
            _converse.chatboxes = new _converse.ChatBoxes();
            /**
             * Triggered once the _converse.ChatBoxes collection has been initialized.
             * @event _converse#chatBoxesInitialized
             * @example _converse.api.listen.on('chatBoxesInitialized', () => { ... });
             * @example _converse.api.waitUntil('chatBoxesInitialized').then(() => { ... });
             */
            _converse.api.trigger('chatBoxesInitialized');
        });

        _converse.api.listen.on('presencesInitialized', (reconnecting) => _converse.chatboxes.onConnected(reconnecting));
        _converse.api.listen.on('reconnected', () => _converse.chatboxes.forEach(m => m.onReconnection()));
        _converse.api.listen.on('windowStateChanged', d => (d.state === 'visible') && _converse.clearMsgCounter());
        /************************ END Event Handlers ************************/


        /************************ BEGIN API ************************/
        Object.assign(_converse.api, {
            /**
             * The "chatboxes" namespace.
             *
             * @namespace _converse.api.chatboxes
             * @memberOf _converse.api
             */
            chatboxes: {
                /**
                 * @method _converse.api.chats.create
                 * @param { String|String[] } jids - A JID or array of JIDs
                 * @param { Object } [attrs] An object containing configuration attributes
                 * @param { Model } model - The type of chatbox that should be created
                 */
                async create (jids=[], attrs={}, model) {
                    await _converse.api.waitUntil('chatBoxesFetched');
                    if (isString(jids)) {
                        return createChatBox(jids, attrs, model);
                    } else {
                        return Promise.all(jids.map(jid => createChatBox(jid, attrs, model)));
                    }
                },

                /**
                 * @method _converse.api.chats.get
                 * @param { String|String[] } jids - A JID or array of JIDs
                 */
                async get (jids) {
                    await _converse.api.waitUntil('chatBoxesFetched');
                    if (jids === undefined) {
                        return _converse.chatboxes.models;
                    } else if (isString(jids)) {
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
