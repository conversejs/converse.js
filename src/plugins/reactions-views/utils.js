/**
 * @typedef {import('@converse/headless/types/shared/message').default} BaseMessage
 * @typedef {import('@converse/headless/types/shared/types').ChatBoxOrMUC} ChatBoxOrMUC
 */
import { _converse, api, converse, log, u } from '@converse/headless';
import { __ } from 'i18n';
import { alertSendError } from 'shared/chat/send-errors.js';
const { Strophe, sizzle } = converse.env;

/**
 * Delegate to {@link PopularEmojis#getPopularEmojis} to avoid duplicating the
 * sorted-emojis + defaults-fallback logic.
 * @param {string[]} allowed_emojis
 * @returns {Promise<string[]>}
 */
export async function getPopularReactions(allowed_emojis) {
    const popular_emojis = _converse.state.popular_emojis;
    if (!popular_emojis) return [];

    const data = await popular_emojis.getPopularEmojis();
    const emojis = Object.keys(data);
    return allowed_emojis ? emojis.filter((e) => allowed_emojis.includes(e)) : emojis;
}

/**
 * Toggles one of our reactions to a message: adds the emoji if we haven't
 * reacted with it, removes it if we have. Headless sends our resulting set.
 *
 * @param {BaseMessage} message - The message model to update
 * @param {string} emoji - The selected emoji or shortname
 */
export async function sendReaction(message, emoji) {
    if (!emoji) return;

    let emoji_unicode = emoji;
    if (emoji.startsWith(':') && emoji.endsWith(':')) {
        const emoji_array = u.shortnamesToEmojis(emoji, { unicode_only: true });
        emoji_unicode = Array.isArray(emoji_array) ? emoji_array.join('') : emoji_array;
    }

    if (emoji_unicode.startsWith(':') && emoji_unicode.endsWith(':')) {
        log.error(`sendReaction: could not convert shortname to emoji: ${emoji}`);
        return;
    }

    /** @type {ChatBoxOrMUC} */
    const chatbox = message.collection.chatbox;
    const my_jid = u.reactions.getOwnReactionJID(chatbox);
    const my_reactions = new Set(message.get('reactions')?.[my_jid] || []);

    if (my_reactions.has(emoji_unicode)) {
        my_reactions.delete(emoji_unicode);
    } else {
        my_reactions.add(emoji_unicode);
        // Bump it to the front of the popular emojis list, and schedule a
        // debounced publish to the user's PEP node.
        _converse.state.popular_emojis?.recordUsage([emoji_unicode]);
    }

    try {
        // Headless encrypts the reaction when the chat is OMEMO-encrypted, and undoes the
        // optimistic update when the send fails. It doesn't alert, so the view does.
        await api.reactions.send(message, Array.from(my_reactions));
    } catch (e) {
        alertSendError(/** @type {Error} */ (e));
        log.error(e);
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
 * @param {ChatBoxOrMUC} chatbox - The chatbox model
 * @returns {Promise<string>}
 */
export async function getReactorNames(jids, chatbox) {
    const is_muc = chatbox.get('type') === 'chatroom';
    const own_bare_jid = _converse.session.get('bare_jid');

    /**
     * @param {string} key - occupant_id, bare JID, or full JID
     * @returns {Promise<string>}
     */
    const resolve = async (key) => {
        if (is_muc) {
            // Try to look up the occupant by occupant_id first, then by bare JID,
            // then fall back to extracting the nick from the resource part of a full JID.
            const occupants = chatbox.occupants;
            const by_occupant_id = occupants?.findWhere({ 'occupant_id': key });
            if (by_occupant_id) return by_occupant_id.get('nick') || key;
            const by_jid = occupants?.findWhere({ 'jid': key });
            if (by_jid) return by_jid.get('nick') || key;
            return Strophe.getResourceFromJid(key) || key;
        }
        if (Strophe.getBareJidFromJid(key) === own_bare_jid) {
            // The reactor is the logged-in user — look up the profile directly,
            // since our own JID is not present in the roster contacts list.
            return _converse.state.profile?.getDisplayName() ?? key;
        }
        const contact = await api.contacts.get(key);
        return contact?.getDisplayName() ?? key;
    };

    const max_named = 2;
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

    /** @type {ChatBoxOrMUC|undefined} */
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
