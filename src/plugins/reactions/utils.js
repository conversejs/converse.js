import { converse } from '@converse/headless';

/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */

/**
 * Helper function to update a message with reactions (JID-keyed format).
 * Used for optimistic updates when sending reactions.
 *
 * Reactions are stored as `{ jid: [emoji1, emoji2, ...] }`.
 *
 * @param {Object} message - The message model to update
 * @param {string} from_jid - The JID of the user reacting (bare JID)
 * @param {Array<string>} emojis - The list of emojis (can be empty for removal)
 */
export function updateMessageReactions (message, from_jid, emojis) {
    const { Strophe } = converse.env;
    const bare_from_jid = Strophe.getBareJidFromJid(from_jid);

    const current_reactions = message.get('reactions') || {};
    const reactions = { ...current_reactions };

    if (emojis.length === 0) {
        delete reactions[bare_from_jid];
    } else {
        reactions[bare_from_jid] = emojis;
    }

    message.save({ 'reactions': reactions });
}

/**
 * Convert JID-keyed reactions to emoji-keyed format for display.
 *
 * Input:  `{ jid1: ['👍', '❤️'], jid2: ['👍'] }`
 * Output: `{ '👍': ['jid1', 'jid2'], '❤️': ['jid1'] }`
 *
 * @param {Record<string, string[]>} reactions - JID-keyed reactions map
 * @returns {Record<string, string[]>} - Emoji-keyed map for display
 */
export function getEmojiKeyedReactions (reactions) {
    /** @type {Record<string, string[]>} */
    const emoji_map = {};
    for (const jid in reactions) {
        for (const emoji of reactions[jid]) {
            if (!emoji_map[emoji]) {
                emoji_map[emoji] = [];
            }
            emoji_map[emoji].push(jid);
        }
    }
    return emoji_map;
}

