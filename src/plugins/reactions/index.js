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

import { converse, api, _converse } from '@converse/headless';
import { sendReaction } from './utils.js';
import './reaction-picker.js';

import { __ } from 'i18n';

const { Strophe } = converse.env;

converse.plugins.add('converse-reaction-views', {

    dependencies: ['converse-reactions', 'converse-disco', 'converse-chatview', 'converse-muc-views'],

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

        const registerRestrictedReactionsHandler = () => {
            api.connection.get()?.addHandler(
                /** @param {Element} stanza */
                (stanza) => {
                    const query = stanza.querySelector(`query[xmlns="${Strophe.NS.DISCO_INFO}"]`);
                    if (!query) {
                        return true;
                    }
                    const feature = query.querySelector(`feature[var="${Strophe.NS.REACTIONS}#restricted"]`);
                    if (!feature) {
                        return true;
                    }

                    const from_jid = stanza.getAttribute('from');
                    if (!from_jid) {
                        return true;
                    }

                    const bare_jid = Strophe.getBareJidFromJid(from_jid);
                    const allowed = Array.from(feature.querySelectorAll('allow'))
                        .map((el) => el.textContent)
                        .filter(Boolean);

                    this.allowed_emojis.set(bare_jid, allowed);
                    this.allowed_emojis.set(from_jid, allowed);

                    const chatbox = api.chatboxes.get(from_jid) || api.chatboxes.get(bare_jid);
                    chatbox?.set('allowed_reactions', allowed);
                    return true;
                },
                Strophe.NS.DISCO_INFO,
                'iq',
                'result'
            );
        };

        api.listen.on('connected', registerRestrictedReactionsHandler);
        api.listen.on('reconnected', registerRestrictedReactionsHandler);

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
        return sendReaction(message, emoji);
    },

    onReactionSelected (ev) {
        const emoji = ev.detail?.emoji;
        const message = ev.detail?.model;
        if (emoji && message) {
            this.sendReaction(message, emoji);
        }
    }
});
