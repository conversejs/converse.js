import { api, converse, u } from '@converse/headless';

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
 * Send a XEP-0444 reaction stanza and optimistically update the message.
 *
 * @param {Object} message - The message model to update
 * @param {string} emoji - The selected emoji or shortname
 */
export function sendReaction (message, emoji) {
    const { Stanza, Strophe, stx } = converse.env;
    const chatbox = message.collection.chatbox;
    const msg_id = message.get('msgid');
    const to_jid = chatbox.get('jid');
    const type = chatbox.get('type') === 'chatroom' ? 'groupchat' : 'chat';

    if (!emoji) {
        return;
    }

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
    const my_reactions = new Set(current_reactions[my_jid] || []);

    if (my_reactions.has(emoji_unicode)) {
        my_reactions.delete(emoji_unicode);
    } else {
        my_reactions.add(emoji_unicode);
    }

    const reactions_xml = Array.from(my_reactions).map((reaction) => `<reaction>${reaction}</reaction>`).join('');
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
        conn.addHandler(
            (stanza) => {
                const error = stanza.querySelector('error');
                if (error) {
                    const error_type = error.getAttribute('type');
                    const error_condition = error
                        .querySelector('[xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"]')
                        ?.tagName;

                    if (error_condition === 'not-acceptable' || error_type === 'cancel') {
                        updateMessageReactions(message, my_jid, []);
                    }
                }
                return false;
            },
            null,
            'message',
            'error',
            reaction_id,
            to_jid
        );
    }
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

