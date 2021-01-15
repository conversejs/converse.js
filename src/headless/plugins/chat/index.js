/**
 * @module converse-chat
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import ChatBox from './model.js';
import MessageMixin from './message.js';
import ModelWithContact from './model-with-contact.js';
import chat_api from './api.js';
import log from '../../log.js';
import { Collection } from "@converse/skeletor/src/collection";
import { _converse, api, converse } from '../../core.js';
import { isServerMessage, } from '@converse/headless/shared/parsers';
import { parseMessage } from './parsers.js';

const { Strophe, sizzle, utils } = converse.env;
const u = converse.env.utils;

async function handleErrorMessage (stanza) {
    const from_jid = Strophe.getBareJidFromJid(stanza.getAttribute('from'));
    if (utils.isSameBareJID(from_jid, _converse.bare_jid)) {
        return;
    }
    const chatbox = await api.chatboxes.get(from_jid);
    chatbox?.handleErrorMessageStanza(stanza);
}

converse.plugins.add('converse-chat', {
    /* Optional dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin. They are called "optional" because they might not be
     * available, in which case any overrides applicable to them will be
     * ignored.
     *
     * It's possible however to make optional dependencies non-optional.
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found.
     *
     * NB: These plugins need to have already been loaded via require.js.
     */
    dependencies: ['converse-chatboxes', 'converse-disco'],

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */

        Object.assign(api, chat_api);

        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        api.settings.extend({
            'allow_message_corrections': 'all',
            'allow_message_retraction': 'all',
            'allow_message_styling': true,
            'auto_join_private_chats': [],
            'clear_messages_on_reconnection': false,
            'filter_by_resource': false,
            'send_chat_markers': ["received", "displayed", "acknowledged"],
            'send_chat_state_notifications': true,
        });

        _converse.Message = ModelWithContact.extend(MessageMixin);
        _converse.Messages = Collection.extend({
            model: _converse.Message,
            comparator: 'time'
        });
        _converse.ChatBox = ChatBox;

        /**
         * Handler method for all incoming single-user chat "message" stanzas.
         * @private
         * @method _converse#handleMessageStanza
         * @param { MessageAttributes } attrs - The message attributes
         */
        _converse.handleMessageStanza = async function (stanza) {
            if (isServerMessage(stanza)) {
                // Prosody sends headline messages with type `chat`, so we need to filter them out here.
                const from = stanza.getAttribute('from');
                return log.info(`handleMessageStanza: Ignoring incoming server message from JID: ${from}`);
            }
            const attrs = await parseMessage(stanza, _converse);
            if (u.isErrorObject(attrs)) {
                attrs.stanza && log.error(attrs.stanza);
                return log.error(attrs.message);
            }
            const has_body = !!sizzle(`body, encrypted[xmlns="${Strophe.NS.OMEMO}"]`, stanza).length;
            const chatbox = await api.chats.get(attrs.contact_jid, { 'nickname': attrs.nick }, has_body);
            await chatbox?.queueMessage(attrs);
            /**
             * @typedef { Object } MessageData
             * An object containing the original message stanza, as well as the
             * parsed attributes.
             * @property { XMLElement } stanza
             * @property { MessageAttributes } stanza
             * @property { ChatBox } chatbox
             */
            const data = { stanza, attrs, chatbox };
            /**
             * Triggered when a message stanza is been received and processed.
             * @event _converse#message
             * @type { object }
             * @property { module:converse-chat~MessageData } data
             */
            api.trigger('message', data);
        };

        function registerMessageHandlers () {
            _converse.connection.addHandler(
                stanza => {
                    if (sizzle(`message > result[xmlns="${Strophe.NS.MAM}"]`, stanza).pop()) {
                        // MAM messages are handled in converse-mam.
                        // We shouldn't get MAM messages here because
                        // they shouldn't have a `type` attribute.
                        log.warn(`Received a MAM message with type "chat".`);
                        return true;
                    }
                    _converse.handleMessageStanza(stanza);
                    return true;
                },
                null,
                'message',
                'chat'
            );

            _converse.connection.addHandler(
                stanza => {
                    // Message receipts are usually without the `type` attribute. See #1353
                    if (stanza.getAttribute('type') !== null) {
                        // TODO: currently Strophe has no way to register a handler
                        // for stanzas without a `type` attribute.
                        // We could update it to accept null to mean no attribute,
                        // but that would be a backward-incompatible change
                        return true; // Gets handled above.
                    }
                    _converse.handleMessageStanza(stanza);
                    return true;
                },
                Strophe.NS.RECEIPTS,
                'message'
            );

            _converse.connection.addHandler(
                stanza => {
                    handleErrorMessage(stanza);
                    return true;
                },
                null,
                'message',
                'error'
            );
        }

        function autoJoinChats () {
            // Automatically join private chats, based on the
            // "auto_join_private_chats" configuration setting.
            api.settings.get('auto_join_private_chats').forEach(jid => {
                if (_converse.chatboxes.where({ 'jid': jid }).length) {
                    return;
                }
                if (typeof jid === 'string') {
                    api.chats.open(jid);
                } else {
                    log.error('Invalid jid criteria specified for "auto_join_private_chats"');
                }
            });
            /**
             * Triggered once any private chats have been automatically joined as
             * specified by the `auto_join_private_chats` setting.
             * See: https://conversejs.org/docs/html/configuration.html#auto-join-private-chats
             * @event _converse#privateChatsAutoJoined
             * @example _converse.api.listen.on('privateChatsAutoJoined', () => { ... });
             * @example _converse.api.waitUntil('privateChatsAutoJoined').then(() => { ... });
             */
            api.trigger('privateChatsAutoJoined');
        }

        /************************ BEGIN Route Handlers ************************/
        function openChat (jid) {
            if (!utils.isValidJID(jid)) {
                return log.warn(`Invalid JID "${jid}" provided in URL fragment`);
            }
            api.chats.open(jid);
        }
        _converse.router.route('converse/chat?jid=:jid', openChat);
        /************************ END Route Handlers ************************/

        /************************ BEGIN Event Handlers ************************/
        api.listen.on('chatBoxesFetched', autoJoinChats);
        api.listen.on('presencesInitialized', registerMessageHandlers);

        api.listen.on('clearSession', async () => {
            if (_converse.shouldClearCache()) {
                await Promise.all(
                    _converse.chatboxes.map(c => c.messages && c.messages.clearStore({ 'silent': true }))
                );
                const filter = o => o.get('type') !== _converse.CONTROLBOX_TYPE;
                _converse.chatboxes.clearStore({ 'silent': true }, filter);
            }
        });
        /************************ END Event Handlers ************************/
    }
});
