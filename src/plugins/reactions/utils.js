/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */

/**
 * Helper function to update a message with a new reaction
 * @param {Object} message - The message model to update
 * @param {string} from_jid - The JID of the user reacting
 * @param {Array<string>} emojis - The list of emojis (can be empty for removal)
 */
export function updateMessageReactions (message, from_jid, emojis) {
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
}

/**
 * Helper to find message by ID in a chatbox
 * @param {Object} box - The chatbox to search in
 * @param {string} msgId - The message ID to find
 * @returns {Object|null} - The message model or null
 */
export function findMessage (box, msgId) {
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
}
