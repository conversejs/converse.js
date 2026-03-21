import { _converse, api, converse, log, u } from '@converse/headless';
import { __ } from 'i18n';

const { Strophe, sizzle, stx } = converse.env;

/**
 * Returns the JID under which the current user's reactions are stored.
 * For MUC this is the full JID (room@domain/nick), matching the server echo.
 * For 1:1 chats this is the bare JID.
 * @param {Object} chatbox
 * @returns {string}
 */
export function getOwnReactionJID(chatbox) {
    if (chatbox.get('type') === 'chatroom') {
        return `${chatbox.get('jid')}/${chatbox.get('nick')}`;
    }
    return Strophe.getBareJidFromJid(api.connection.get().jid);
}

/**
 * Helper function to update a message with reactions (JID-keyed format).
 * Used for optimistic updates when sending reactions.
 *
 * Reactions are stored as `{ jid: [emoji1, emoji2, ...] }`.
 * For MUC the key is the full JID (room@domain/nick), matching what the
 * server will echo back. For 1:1 chats the key is the bare JID.
 *
 * @param {Object} message - The message model to update
 * @param {Array<string>} emojis - The list of emojis (can be empty for removal)
 */
export function updateMessageReactions(message, emojis) {
    const chatbox = message.collection.chatbox;
    const my_jid = getOwnReactionJID(chatbox);

    const current_reactions = message.get('reactions') || {};
    const reactions = { ...current_reactions };

    if (emojis.length === 0) {
        delete reactions[my_jid];
    } else {
        reactions[my_jid] = emojis;
    }

    message.save({ reactions });
}

/**
 * Send a XEP-0444 reaction stanza and optimistically update the message.
 *
 * @param {Object} message - The message model to update
 * @param {string} emoji - The selected emoji or shortname
 */
export function sendReaction(message, emoji) {
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
        log.error(`sendReaction: could not convert shortname to emoji: ${emoji}`);
        return;
    }

    const my_jid = getOwnReactionJID(chatbox);
    const current_reactions = message.get('reactions') || {};
    const my_reactions = new Set(current_reactions[my_jid] || []);

    if (my_reactions.has(emoji_unicode)) {
        my_reactions.delete(emoji_unicode);
    } else {
        my_reactions.add(emoji_unicode);
    }

    const reaction_id = u.getUniqueId('reaction');
    const reaction_stanza = stx`
        <message to="${to_jid}" type="${type}" id="${reaction_id}" xmlns="jabber:client">
            <reactions xmlns="${Strophe.NS.REACTIONS}" id="${msg_id}">
                ${Array.from(my_reactions).map((reaction) => stx`<reaction>${reaction}</reaction>`)}
            </reactions>
        </message>
    `;

    api.send(reaction_stanza);

    updateMessageReactions(message, Array.from(my_reactions));
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
export function getEmojiKeyedReactions(reactions) {
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

/**
 * Resolves a list of reactor JIDs to human-readable display names.
 *
 * For MUC, the key is a full JID (room@domain/nick) — the nick is extracted
 * directly from the resource part. For 1:1 chats the key is a bare JID and
 * we look up the roster contact for the best available name.
 *
 * Returns a formatted string such as:
 *   "Alice"
 *   "Alice and Bob"
 *   "Alice, Bob and 1 other"
 *   "Alice, Bob and 3 others"
 *
 * @param {string[]} jids - Reactor JIDs (MUC full JIDs or 1:1 bare JIDs)
 * @param {Object} chatbox - The chatbox model
 * @returns {Promise<string>}
 */
export async function getReactorNames(jids, chatbox) {
    const is_muc = chatbox.get('type') === 'chatroom';
    const max_named = 2;

    const own_bare_jid = _converse.session.get('bare_jid');

    /**
     * @param {string} jid
     * @returns {Promise<string>}
     */
    const resolve = async (jid) => {
        if (is_muc) {
            return Strophe.getResourceFromJid(jid) || jid;
        }
        if (Strophe.getBareJidFromJid(jid) === own_bare_jid) {
            // The reactor is the logged-in user — look up the profile directly,
            // since our own JID is not present in the roster contacts list.
            return _converse.state.profile?.getDisplayName() ?? jid;
        }
        const contact = await api.contacts.get(jid);
        return contact?.getDisplayName() ?? jid;
    };

    const named = await Promise.all(jids.slice(0, max_named).map(resolve));
    const remainder = jids.length - named.length;

    if (remainder === 0) {
        // "Alice" or "Alice and Bob"
        return named.length === 1 ? named[0] : __('%1$s and %2$s', named[0], named[1]);
    }
    // "Alice, Bob and 1 other" / "Alice, Bob and 3 others"
    const others_str =
        remainder === 1
            ? __('%1$s and 1 other', named.join(', '))
            : __('%1$s and %2$d others', named.join(', '), remainder);
    return others_str;
}

/** @param {Element} stanza */
async function handleRestrictedReactions(stanza) {
    const query = sizzle(`query[xmlns="${Strophe.NS.DISCO_INFO}"]`, stanza).pop();
    if (!query) {
        return;
    }

    // Per XEP-0444 §2.2, restricted reactions are advertised via a XEP-0128
    // Service Discovery Extensions data form with FORM_TYPE "urn:xmpp:reactions:0:restrictions"
    // and an "allowlist" field whose <value> children list the permitted emojis.
    const form = sizzle(`x[xmlns="jabber:x:data"]`, query).pop();
    if (!form) {
        return;
    }
    const form_type = sizzle(`field[var="FORM_TYPE"] value`, form).pop();
    if (form_type?.textContent !== 'urn:xmpp:reactions:0:restrictions') {
        return;
    }
    const allowlist_field = sizzle(`field[var="allowlist"]`, form).pop();
    if (!allowlist_field) {
        return;
    }

    const from_jid = stanza.getAttribute('from');
    if (!from_jid) {
        return;
    }

    const bare_jid = Strophe.getBareJidFromJid(from_jid);
    const allowed = Array.from(allowlist_field.querySelectorAll('value'))
        .map((el) => el.textContent)
        .filter(Boolean);

    const chatbox = await api.chatboxes.get(bare_jid);
    chatbox?.save('allowed_reactions', allowed);
}

/**
 * Registers a handler for disco#info result stanzas to check for restricted reactions support.
 */
export function registerRestrictedReactionsHandler() {
    api.connection.get()?.addHandler(
        /** @param {Element} stanza */ (stanza) => {
            handleRestrictedReactions(stanza);
            return true;
        },
        Strophe.NS.DISCO_INFO,
        'iq',
        'result',
    );
}
