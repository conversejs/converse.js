/**
 * @module converse-reactions
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description
 * This plugin implements XEP-0444: Message Reactions
 * It allows users to react to messages with emojis (similar to Slack/Discord reactions)
 * 
 * Features:
 * - Add emoji reactions to received messages
 * - Display reaction picker with popular emojis + full emoji selector
 * - Send reactions as XMPP stanzas per XEP-0444
 * - Receive and display reactions from other users
 * - Aggregate reactions by emoji with user counts                                                                      * - Users can have multiple reactions per message
 */

import { converse, api, u, _converse } from '@converse/headless';
import { updateMessageReactions, findMessage } from './utils.js';
import './reaction-picker.js';

import { __ } from 'i18n';

const { Strophe } = converse.env;

Strophe.addNamespace('REACTIONS', 'urn:xmpp:reactions:0');

converse.plugins.add('converse-reactions', {

    dependencies: ['converse-disco', 'converse-chatview', 'converse-muc-views'],

    /**
     * Initializes the reactions plugin
     * Sets up event listeners for:
     * - Adding reaction buttons to messages
     * - Receiving reaction stanzas from XMPP server
     * - Handling connection/reconnection events
     */
    initialize () {
        this.allowed_emojis = new Map(); // Store allowed emojis per JID

        /**
         * Register the "urn:xmpp:reactions:0" feature
         */
        api.listen.on('addClientFeatures', () => {
             api.disco.own.features.add(Strophe.NS.REACTIONS);
        });

        /**
         * Listen for disco info results to parse restricted emojis
         */
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
                    }
                }
            }
        });

        /**
         * Add "Add Reaction" button to message action buttons
         * Only shown for received messages (not own messages)
         * Checks if the contact supports reactions
         * @listens getMessageActionButtons
         */
        api.listen.on('getMessageActionButtons', (el, buttons) => {
                buttons.push({
                    'i18n_text': __('Add Reaction'),
                    'handler': (ev) => this.onReactionButtonClicked(el, ev),
                    'button_class': 'chat-msg__action-reaction',
                    'icon_class': 'fas fa-smile',
                    'name': 'reaction',
                });

            return buttons;
        });

        /**
         * Register XMPP stanza handler for incoming reactions
         * Called on connect and reconnect events
         * Listens for <message> stanzas containing <reactions xmlns='urn:xmpp:reactions:0'/>
         */
        const onConnect = () => {
            /**
             * Handler function for processing incoming message stanzas
             * @param {Element} stanza - The received XMPP message stanza
             * @returns {boolean} - Always returns true to keep handler active
             */
            const handler = (stanza) => {
                // Check for reactions element per XEP-0444
                const reactions = stanza.getElementsByTagNameNS(Strophe.NS.REACTIONS, 'reactions');
                
                if (reactions.length > 0) {
                    this.onReactionReceived(stanza, reactions[0]);
                }
                return true; // Keep handler alive for subsequent stanzas
            };
            
            // Register for ALL message stanzas, then filter internally
            // This approach avoids missing reactions due to type variations
            const conn = api.connection.get();
            if (conn && conn.addHandler) {
                conn.addHandler(handler, null, 'message', null);
            }
        };

        api.listen.on('connected', onConnect);
        api.listen.on('reconnected', onConnect);
        
        // Also try to register immediately if already connected
        if (api.connection.connected()) {
            onConnect();
        }
    },

    /**
     * Process a received reaction stanza
     * Updates the target message's reactions data structure
     * 
     * @param {Element} stanza - The XMPP message stanza containing the reaction
     * @param {Element} reactions_element - The <reactions> element from the stanza
     */
    async onReactionReceived (stanza, reactions_element) {
        const from_jid = stanza.getAttribute('from');
        const id = reactions_element.getAttribute('id'); // Target message ID
        
        // Extract emojis from <reaction> child elements
        const reaction_elements = reactions_element.getElementsByTagName('reaction');
        const emojis = Array.from(reaction_elements).map(el => el.textContent).filter(e => e);
        
        if (!id) return;

        // Strategy 1: Try to find chatbox by sender's bare JID
        const { Strophe } = converse.env;
        const bare_jid = Strophe.getBareJidFromJid(from_jid);
        let chatbox = api.chatboxes.get(bare_jid);
        
        if (chatbox) {
            const message = findMessage(chatbox, id);
            if (message) {
                updateMessageReactions(message, from_jid, emojis);
                return;
            }
        }

        // Strategy 2: Search all open chatboxes (for carbons/multi-device support)
        // This handles cases where reactions come from message carbons or other devices
        const allChatboxes = await api.chatboxes.get();
        for (const cb of allChatboxes) {
            const message = findMessage(cb, id);
            if (message) {
                updateMessageReactions(message, from_jid, emojis);
                return;
            }
        }
    },

    /**
     * Handle click on "Add Reaction" button
     * Creates and displays the reaction picker UI
     * 
     * @param {Element} el - The message element component
     * @param {Event} ev - The click event
     */
    onReactionButtonClicked (el, ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        
        const target = /** @type {HTMLElement} */(ev.target).closest('button');
        const existing_picker = document.querySelector('converse-reaction-picker');
        
        // Toggle: if clicking same button, close picker instead of reopening
        if (existing_picker) {
            const is_same_target = /** @type {any} */(existing_picker).target === target;
            existing_picker.remove();
            if (is_same_target) {
                return;
            }
        }

        // Create reaction picker component
        const pickerEl = document.createElement('converse-reaction-picker');
        const picker = /** @type {HTMLElement & { target: HTMLElement | null; model: any; allowed_emojis: any; }} */ (pickerEl);
        // @ts-ignore - custom element exposes target property
        picker.target = target;
        // @ts-ignore - custom element exposes model property
        picker.model = el.model;
        
        // @ts-ignore
        const chatbox = el.model.collection.chatbox;
        const jid = chatbox.get('jid');
        const { Strophe } = converse.env;
        const bare_jid = Strophe.getBareJidFromJid(jid);
        // @ts-ignore
        picker.allowed_emojis = this.allowed_emojis.get(jid) || this.allowed_emojis.get(bare_jid);
        
        // Position picker below the button
        const rect = target.getBoundingClientRect();
        picker.style.position = 'absolute';
        picker.style.zIndex = '10000'; // Ensure it's above other elements
        picker.style.left = `${rect.left}px`;
        picker.style.top = `${rect.bottom + 5}px`;
        
        // Append to .conversejs container for proper CSS scoping
        // Fallback to converse-root or document.body if container not found
        const converseRoot = document.querySelector('.conversejs') || document.querySelector('converse-root');
        const container = converseRoot || document.body;
        container.appendChild(picker);

        /**
         * Close picker when clicking outside
         * @param {Event} ev - The click event
         */
        const onClickOutside = (ev) => {
            if (!picker.isConnected) {
                document.removeEventListener('click', onClickOutside);
                return;
            }
            const click_target = /** @type {Node} */(ev.target);
            if (!picker.contains(click_target) && !target.contains(click_target)) {
                picker.remove();
                document.removeEventListener('click', onClickOutside);
            }
        };
        // Use setTimeout to avoid immediate trigger if event bubbles
        setTimeout(() => document.addEventListener('click', onClickOutside), 0);

        /**
         * Handle emoji selection from picker
         * @listens reactionSelected
         */
        picker.addEventListener('reactionSelected', (/** @type {CustomEvent} */ e) => {
            const emoji = e.detail.emoji;
            this.sendReaction(/** @type {any} */(el).model, emoji);
            picker.remove();
            document.removeEventListener('click', onClickOutside);
        });
    },

    /**
     * Send a reaction to a message
     * Implements XEP-0444: Message Reactions
     * 
     * @param {Object} message - The message model being reacted to
     * @param {string} emoji - The emoji reaction (can be unicode or shortname like :joy:)
     */
    sendReaction (message, emoji) {
        const { stx, Stanza } = converse.env;
        const chatbox = message.collection.chatbox;
        const msgId = message.get('msgid');
        const to_jid = chatbox.get('jid');
        // Default to 'chat' type unless explicitly a groupchat (MUC)
        const type = chatbox.get('type') === 'groupchat' ? 'groupchat' : 'chat';
        
        if (!emoji) return;

        // Convert emoji shortname (e.g. :joy:) to unicode (e.g. 😂)
        // Check if emoji is already unicode (from emoji picker) or needs conversion (from shortname buttons)
        let emoji_unicode = emoji;
        if (emoji.startsWith(':') && emoji.endsWith(':')) {
            const emoji_array = u.shortnamesToEmojis(emoji, { unicode_only: true });
            emoji_unicode = Array.isArray(emoji_array) ? emoji_array.join('') : emoji_array;
        }

        // Filter out custom emojis (stickers) which don't have a unicode representation
        if (emoji_unicode.startsWith(':') && emoji_unicode.endsWith(':')) {
            return;
        }

        const my_jid = api.connection.get().jid;
        const current_reactions = message.get('reactions') || {};
        // Clone to ensure Backbone detects the change
        const reactions = JSON.parse(JSON.stringify(current_reactions));

        // Determine current user's reactions
        const myReactions = new Set();
        for (const existingEmoji in reactions) {
            if (reactions[existingEmoji].includes(my_jid)) {
                myReactions.add(existingEmoji);
            }
        }

        // Toggle the clicked emoji
        if (myReactions.has(emoji_unicode)) {
            myReactions.delete(emoji_unicode);
        } else {
            myReactions.add(emoji_unicode);
        }

        // Build XEP-0444 reaction stanza with ALL current reactions
        const reactions_xml = Array.from(myReactions).map(r => `<reaction>${r}</reaction>`).join('');
        const reaction_stanza = stx`
            <message to="${to_jid}" type="${type}" id="${u.getUniqueId('reaction')}" xmlns="jabber:client">
                <reactions xmlns="${Strophe.NS.REACTIONS}" id="${msgId}">
                    ${Stanza.unsafeXML(reactions_xml)}
                </reactions>
            </message>
        `;

        // Send stanza to XMPP server
        api.send(reaction_stanza);

        // Optimistic local update for immediate UI feedback
        // Only for 1:1 chats where no server reflection occurs for the sender
        if (type === 'chat') {
            updateMessageReactions(message, my_jid, Array.from(myReactions));
        }
    }
});
