import { converse } from '@converse/headless';

/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */

/**
 * Helper function to update a message with reactions
 * Used for optimistic updates when sending reactions
 * @param {Object} message - The message model to update
 * @param {string} from_jid - The JID of the user reacting (bare JID)
 * @param {Array<string>} emojis - The list of emojis (can be empty for removal)
 */
export function updateMessageReactions (message, from_jid, emojis) {
    const { Strophe } = converse.env;
    const bare_from_jid = Strophe.getBareJidFromJid(from_jid);
    
    const current_reactions = message.get('reactions') || {};
    const reactions = { ...current_reactions };
    
    // Remove user's previous reactions (clear slate for this user)
    // Use bare JID comparison to handle both full and bare JIDs
    for (const existingEmoji in reactions) {
        reactions[existingEmoji] = reactions[existingEmoji].filter(jid => {
            const bare = Strophe.getBareJidFromJid(jid);
            return bare !== bare_from_jid;
        });
        // Remove emoji key if no one else reacted with it
        if (reactions[existingEmoji].length === 0) {
            delete reactions[existingEmoji];
        }
    }
    
    // Add the new reactions (use bare JID for storage)
    emojis.forEach(emoji => {
        if (!reactions[emoji]) {
            reactions[emoji] = [];
        }
        // Check if this user already has this reaction (using bare JID comparison)
        const hasReaction = reactions[emoji].some(jid => 
            Strophe.getBareJidFromJid(jid) === bare_from_jid
        );
        if (!hasReaction) {
            reactions[emoji].push(bare_from_jid);
        }
    });
    
    message.save({ 'reactions': reactions });
}

