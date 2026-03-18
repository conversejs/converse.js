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
import { registerRestrictedReactionsHandler } from './utils.js';
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

        api.listen.on('connected', () => registerRestrictedReactionsHandler(this.allowed_emojis));
        api.listen.on('reconnected', () => registerRestrictedReactionsHandler(this.allowed_emojis));

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
    }
});
