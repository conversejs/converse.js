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
 * - Aggregate reactions by emoji with user counts
 * - Users can only have one reaction per message (changing reaction replaces previous)
 */

import { converse, api, u } from '@converse/headless';
import './reaction-picker.js';

import { __ } from 'i18n';

converse.plugins.add('reactions', {

    /**
     * Initializes the reactions plugin
     * Sets up event listeners for:
     * - Adding reaction buttons to messages
     * - Receiving reaction stanzas from XMPP server
     * - Handling connection/reconnection events
     */
    initialize () {
        /**
         * Add "Add Reaction" button to message action buttons
         * Only shown for received messages (not own messages)
         * @listens getMessageActionButtons
         */
        api.listen.on('getMessageActionButtons', (el, buttons) => {
            const is_own_message = el.model.get('sender') === 'me';
            if (!is_own_message) {
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
         * Listens for <message> stanzas containing <reaction xmlns='urn:xmpp:reactions:0'/>
         */
        const onConnect = () => {
            /**
             * Handler function for processing incoming message stanzas
             * @param {Element} stanza - The received XMPP message stanza
             * @returns {boolean} - Always returns true to keep handler active
             */
            const handler = (stanza) => {
                // Check for reaction element per XEP-0444
                const reactions = stanza.getElementsByTagNameNS('urn:xmpp:reactions:0', 'reaction');
                
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
     * @param {Element} reactionElement - The <reaction> element from the stanza
     * 
     * Reaction format (XEP-0444):
     * <message from='user@domain' to='recipient@domain' type='chat'>
     *   <reaction xmlns='urn:xmpp:reactions:0' id='target-message-id'>
     *     <emoji>👍</emoji>
     *   </reaction>
     * </message>
     * 
     * Reactions are stored on messages as:
     * {
     *   '👍': ['user1@domain', 'user2@domain'],
     *   '❤️': ['user3@domain']
     * }
     */
    async onReactionReceived (stanza, reactionElement) {
        const from_jid = stanza.getAttribute('from');
        const id = reactionElement.getAttribute('id'); // Target message ID
        
        // Extract emoji from <emoji> child element
        const emojis = reactionElement.getElementsByTagNameNS('urn:xmpp:reactions:0', 'emoji');
        const emoji = emojis.length > 0 ? emojis[0].textContent : null;

        if (!id || !emoji) return;

        /**
         * Helper function to update a message with a new reaction
         * @param {Object} message - The message model to update
         * 
         * Process:
         * 1. Clone reactions object to ensure Backbone detects changes
         * 2. Remove user's previous reactions (one reaction per message)
         * 3. Add the new reaction
         * 4. Save to message model (triggers view update)
         */
        const updateMessage = (message) => {
            // IMPORTANT: Clone the reactions object to ensure Backbone detects the change
            const current_reactions = message.get('reactions') || {};
            const reactions = JSON.parse(JSON.stringify(current_reactions));
            
            // Remove user's previous reactions (they can only have one reaction per message)
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
            
            // Add the new reaction
            if (!reactions[emoji]) {
                reactions[emoji] = [];
            }
            reactions[emoji].push(from_jid);
            
            message.save({ 'reactions': reactions });
        };

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
                updateMessage(message);
                return;
            }
        }

        // Strategy 2: Search all open chatboxes (for carbons/multi-device support)
        // This handles cases where reactions come from message carbons or other devices
        const allChatboxes = await api.chatboxes.get();
        for (const cb of allChatboxes) {
            const message = findMessage(cb, id);
            if (message) {
                updateMessage(message);
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
        const picker = /** @type {HTMLElement & { target: HTMLElement | null; model: any; }} */ (pickerEl);
        // @ts-ignore - custom element exposes target property
        picker.target = target;
        // @ts-ignore - custom element exposes model property
        picker.model = el.model;
        
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
     * 
     * Process:
     * 1. Convert emoji shortname to unicode if needed
     * 2. Build XEP-0444 compliant stanza
     * 3. Send via XMPP connection
     * 4. Optimistically update local state for immediate UI feedback
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

        // Build XEP-0444 reaction stanza
        const reaction = $msg({
            'to': to_jid,
            'type': type,
            'id': u.getUniqueId('reaction')
        }).c('reaction', {
            'xmlns': 'urn:xmpp:reactions:0',
            'id': msgId  // ID of the message being reacted to
        }).c('emoji').t(emojiUnicode);

        // Send stanza to XMPP server
        api.send(reaction);

        // Optimistic local update for immediate UI feedback
        const my_jid = api.connection.get().jid;
        const currentReactions = message.get('reactions') || {};
        // Clone to ensure Backbone detects the change
        const reactions = JSON.parse(JSON.stringify(currentReactions));

        // Remove user's previous reactions (one reaction per message per XEP-0444)
        for (const existingEmoji in reactions) {
            const index = reactions[existingEmoji].indexOf(my_jid);
            if (index !== -1) {
                reactions[existingEmoji].splice(index, 1);
                // Clean up emoji key if no users remain
                if (reactions[existingEmoji].length === 0) {
                    delete reactions[existingEmoji];
                }
            }
        }

        // Add the new reaction
        if (!reactions[emojiUnicode]) {
            reactions[emojiUnicode] = [];
        }
        reactions[emojiUnicode].push(my_jid);
        
        // Save to model - triggers view re-render
        message.save({ 'reactions': reactions });
    }
});
