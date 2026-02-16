/**
 * @module converse-reactions
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description
 * This plugin implements XEP-0444: Message Reactions UI
 * It allows users to react to messages with emojis (similar to Slack/Discord reactions)
 * 
 * Features:
 * - Add emoji reactions to messages
 * - Display reaction picker with popular emojis + full emoji selector
 * - Send reactions as XMPP stanzas per XEP-0444
 */

import { converse, api, u, _converse } from '@converse/headless';
import { updateMessageReactions } from './utils.js';
import './reaction-picker.js';

import { __ } from 'i18n';

const { Strophe } = converse.env;

converse.plugins.add('converse-reactions', {

    dependencies: ['converse-headless-reactions', 'converse-disco', 'converse-chatview', 'converse-muc-views'],

    /**
     * Initializes the reactions UI plugin
     * Sets up event listeners for:
     * - Adding reaction buttons to messages
     * - Handling reaction picker interactions
     * - Disco feature advertisement and restrictions
     */
    initialize () {
        this.allowed_emojis = new Map();

        api.settings.extend({
            'popular_reactions': [':thumbsup:', ':heart:', ':joy:', ':open_mouth:']
        });

        // Advertise reactions support 
        api.listen.on('addClientFeatures', () => {
            api.disco.own.features.add(Strophe.NS.REACTIONS);
        });

        api.listen.on('stanza', (stanza) => {
            if (stanza.nodeName === 'iq' && stanza.getAttribute('type') === 'result') {
                const query = stanza.querySelector(`query[xmlns="${Strophe.NS.DISCO_INFO}"]`);
                if (query) {
                    const from_jid = stanza.getAttribute('from');
                    const bare_jid = Strophe.getBareJidFromJid(from_jid);
                    const feature = query.querySelector(`feature[var="${Strophe.NS.REACTIONS}#restricted"]`);
                    if (feature) {
                        const allowed = Array.from(feature.querySelectorAll('allow')).map(el => el.textContent);
                        this.allowed_emojis.set(bare_jid, allowed);
                        this.allowed_emojis.set(from_jid, allowed);

                        const chatbox = api.chatboxes.get(from_jid) || api.chatboxes.get(bare_jid);
                        chatbox?.set('allowed_reactions', allowed);
                    }
                }
            }
        });

        api.listen.on('getMessageActionButtons', (el, buttons) => {
            buttons.push({
                'i18n_text': __('Add Reaction'),
                'handler': (ev) => {
                    ev?.preventDefault?.();
                    ev?.stopPropagation?.();
                    const message = el.closest('converse-chat-message') || el.getRootNode()?.host;
                    if (message) {
                        message.show_reaction_picker = !message.show_reaction_picker;
                    }
                    const dropdown = el.renderRoot?.querySelector('converse-dropdown');
                    dropdown?.dropdown?.hide?.();
                },
                'button_class': 'chat-msg__action-reaction',
                'icon_class': 'fas fa-smile',
                'name': 'reaction',
            });

            return buttons;
        });
    },

    sendReaction (message, emoji) {
        const { stx, Stanza } = converse.env;
        const chatbox = message.collection.chatbox;
        const msg_id = message.get('msgid');
        const to_jid = chatbox.get('jid');
        const type = chatbox.get('type') === 'groupchat' ? 'groupchat' : 'chat';
        
        if (!emoji) return;

        let emoji_unicode = emoji;
        if (emoji.startsWith(':') && emoji.endsWith(':')) {
            const emoji_array = u.shortnamesToEmojis(emoji, { unicode_only: true });
            emoji_unicode = Array.isArray(emoji_array) ? emoji_array.join('') : emoji_array;
        }

        if (emoji_unicode.startsWith(':') && emoji_unicode.endsWith(':')) {
            return;
        }

        const my_jid = Strophe.getBareJidFromJid(api.connection.get().jid);
        const current_reactions = message.get('reactions') || {};
        const reactions = { ...current_reactions };

        const my_reactions = new Set();
        for (const existing_emoji in reactions) {
            for (const jid of reactions[existing_emoji]) {
                const bare = Strophe.getBareJidFromJid(jid);
                if (bare === my_jid) {
                    my_reactions.add(existing_emoji);
                    break;
                }
            }
        }

        if (my_reactions.has(emoji_unicode)) {
            my_reactions.delete(emoji_unicode);
        } else {
            my_reactions.add(emoji_unicode);
        }

        const reactions_xml = Array.from(my_reactions).map(r => `<reaction>${r}</reaction>`).join('');
        const reaction_id = u.getUniqueId('reaction');
        const reaction_stanza = stx`
            <message to="${to_jid}" type="${type}" id="${reaction_id}" xmlns="jabber:client">
                <reactions xmlns="${Strophe.NS.REACTIONS}" id="${msg_id}">
                    ${Stanza.unsafeXML(reactions_xml)}
                </reactions>
            </message>
        `;

        api.send(reaction_stanza);

        updateMessageReactions(message, my_jid, Array.from(my_reactions));

        const conn = api.connection.get();
        if (conn) {
            const handler = (stanza) => {
                const error = stanza.querySelector('error');
                if (error) {
                    const error_type = error.getAttribute('type');
                    const error_condition = error.querySelector('[xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"]')?.tagName;
                    
                    if (error_condition === 'not-acceptable' || error_type === 'cancel') {
                        updateMessageReactions(message, my_jid, []);
                    }
                }
                return false;
            };
            conn.addHandler(handler, null, 'message', 'error', reaction_id, to_jid);
        }
    },

    onReactionSelected (ev) {
        const emoji = ev.detail?.emoji;
        const message = ev.detail?.model;
        if (emoji && message) {
            this.sendReaction(message, emoji);
        }
    }
});
