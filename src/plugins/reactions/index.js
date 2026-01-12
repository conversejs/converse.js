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
import './reaction-picker.js';

import { __ } from 'i18n';

converse.plugins.add('reactions', {

    dependencies: ['converse-disco', 'converse-chatview', 'converse-muc-views'],

    /**
     * Initializes the reactions plugin
     * Sets up event listeners for:
     * - Adding reaction buttons to messages
     * - Receiving reaction stanzas from XMPP server
     * - Handling connection/reconnection events
     */
    initialize () {
        const { Strophe } = converse.env;
        this.allowed_emojis = new Map(); // Store allowed emojis per JID

        /**
         * Register the "urn:xmpp:reactions:0" feature
         */
        api.listen.on('addClientFeatures', () => {
            api.disco.own.features.add('urn:xmpp:reactions:0');
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
                    const feature = query.querySelector(`feature[var="urn:xmpp:reactions:0#restricted"]`);
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
            const is_own_message = el.model.get('sender') === 'me';
            if (!is_own_message) {
                const chatbox = el.model.collection.chatbox;
                const jid = chatbox.get('jid');
                const type = chatbox.get('type');

                // Check for support in 1:1 chats
                if (type === 'chat') {
                    const entity = _converse.api.disco.entities.get(jid);
                    // If we have disco info, check for the feature
                    if (entity && entity.features && entity.features.length > 0) {
                        const supportsReactions = entity.features.findWhere({'var': 'urn:xmpp:reactions:0'});
                        if (!supportsReactions) {
                            return buttons;
                        }
                    }
                    // If unknown, we default to showing it (or we could trigger a disco check here)
                }

                buttons.push({
                    'i18n_text': __('Add Reaction'),
                    'handler': (ev) => this.onReactionButtonClicked(el, ev),
                    'button_class': 'chat-msg__action-reaction',
                    'icon_class': 'fas fa-smile',
                    'name': 'reaction',
                });
            }
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
                const reactions = stanza.getElementsByTagNameNS('urn:xmpp:reactions:0', 'reactions');
                
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
     * Helper function to update a message with a new reaction
     * @param {Object} message - The message model to update
     * @param {string} from_jid - The JID of the user reacting
     * @param {Array<string>} emojis - The list of emojis (can be empty for removal)
     */
    updateMessageReactions (message, from_jid, emojis) {
        // IMPORTANT: Clone the reactions object to ensure Backbone detects the change
        const current_reactions = message.get('reactions') || {};
        const reactions = JSON.parse(JSON.stringify(current_reactions));
        
        // Remove user's previous reactions (clear slate for this user)
        for (const existingEmoji in reactions) {
            const index = reactions[existingEmoji].indexOf(from_jid);
            if (index !== -1) {
                reactions[existingEmoji].splice(index, 1);
                // Remove emoji key if no one else reacted with it
                if (reactions[existingEmoji].length === 0) {
                    delete reactions[existingEmoji];
                }
            }
        }
        
        // Add the new reactions
        emojis.forEach(emoji => {
            if (!reactions[emoji]) {
                reactions[emoji] = [];
            }
            if (!reactions[emoji].includes(from_jid)) {
                reactions[emoji].push(from_jid);
            }
        });
        
        message.save({ 'reactions': reactions });
    },

    /**
     * Process a received reaction stanza
     * Updates the target message's reactions data structure
     * 
     * @param {Element} stanza - The XMPP message stanza containing the reaction
     * @param {Element} reactionsElement - The <reactions> element from the stanza
     */
    async onReactionReceived (stanza, reactionsElement) {
        const from_jid = stanza.getAttribute('from');
        const id = reactionsElement.getAttribute('id'); // Target message ID
        
        // Extract emojis from <reaction> child elements
        const reactionElements = reactionsElement.getElementsByTagName('reaction');
        const emojis = Array.from(reactionElements).map(el => el.textContent).filter(e => e);

        if (!id) return;

        // Strategy 1: Try to find chatbox by sender's bare JID
        const { Strophe } = converse.env;
        const bare_jid = Strophe.getBareJidFromJid(from_jid);
        let chatbox = api.chatboxes.get(bare_jid);
        
        /**
         * Helper to find message by ID in a chatbox
         * @param {Object} box - The chatbox to search in
         * @param {string} msgId - The message ID to find
         * @returns {Object|null} - The message model or null
         */
        const findMessage = (box, msgId) => {
            if (!box || !box.messages) {
                return null;
            }
            // Try direct lookup first
            let msg = box.messages.get(msgId);
            if (!msg) {
                // Fallback to findWhere for older messages
                msg = box.messages.findWhere({ 'msgid': msgId });
            }
            return msg;
        };

        if (chatbox) {
            const message = findMessage(chatbox, id);
            if (message) {
                this.updateMessageReactions(message, from_jid, emojis);
                return;
            }
        }

        // Strategy 2: Search all open chatboxes (for carbons/multi-device support)
        // This handles cases where reactions come from message carbons or other devices
        const allChatboxes = await api.chatboxes.get();
        for (const cb of allChatboxes) {
            const message = findMessage(cb, id);
            if (message) {
                this.updateMessageReactions(message, from_jid, emojis);
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
            const isSameTarget = /** @type {any} */(existing_picker).target === target;
            existing_picker.remove();
            if (isSameTarget) {
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
            const clickTarget = /** @type {Node} */(ev.target);
            if (!picker.contains(clickTarget) && !target.contains(clickTarget)) {
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
        const { $msg } = converse.env;
        const chatbox = message.collection.chatbox;
        const msgId = message.get('msgid');
        const to_jid = chatbox.get('jid');
        // Default to 'chat' type unless explicitly a groupchat (MUC)
        const type = chatbox.get('type') === 'groupchat' ? 'groupchat' : 'chat';
        
        if (!emoji) return;

        // Convert emoji shortname (e.g. :joy:) to unicode (e.g. 😂)
        // Check if emoji is already unicode (from emoji picker) or needs conversion (from shortname buttons)
        let emojiUnicode = emoji;
        if (emoji.startsWith(':') && emoji.endsWith(':')) {
            const emojiArray = u.shortnamesToEmojis(emoji, { unicode_only: true });
            emojiUnicode = Array.isArray(emojiArray) ? emojiArray.join('') : emojiArray;
        }

        // Filter out custom emojis (stickers) which don't have a unicode representation
        if (emojiUnicode.startsWith(':') && emojiUnicode.endsWith(':')) {
            return;
        }

        const my_jid = api.connection.get().jid;
        const currentReactions = message.get('reactions') || {};
        // Clone to ensure Backbone detects the change
        const reactions = JSON.parse(JSON.stringify(currentReactions));

        // Determine current user's reactions
        const myReactions = new Set();
        for (const existingEmoji in reactions) {
            if (reactions[existingEmoji].includes(my_jid)) {
                myReactions.add(existingEmoji);
            }
        }

        // Toggle the clicked emoji
        if (myReactions.has(emojiUnicode)) {
            myReactions.delete(emojiUnicode);
        } else {
            myReactions.add(emojiUnicode);
        }

        // Build XEP-0444 reaction stanza with ALL current reactions
        const reactionStanza = $msg({
            'to': to_jid,
            'type': type,
            'id': u.getUniqueId('reaction')
        }).c('reactions', {
            'xmlns': 'urn:xmpp:reactions:0',
            'id': msgId  // ID of the message being reacted to
        });

        myReactions.forEach(r => {
            reactionStanza.c('reaction').t(r).up();
        });

        // Send stanza to XMPP server
        api.send(reactionStanza);

        // Optimistic local update for immediate UI feedback
        // Only for 1:1 chats where no server reflection occurs for the sender
        if (type === 'chat') {
            this.updateMessageReactions(message, my_jid, Array.from(myReactions));
        }
    }
});
