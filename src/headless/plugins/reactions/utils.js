import log from '@converse/log';
import converse from '../../shared/api/public.js';
import api from '../../shared/api/index.js';
import _converse from '../../shared/_converse.js';

const { Strophe, stx, u } = converse.env;

/**
 * @typedef {import('../../shared/types').MessageAttributes} MessageAttributes
 * @typedef {import('../../plugins/muc/types').MUCMessageAttributes} MUCMessageAttributes
 * @typedef {import('./types').MessageAttrsWithReactions} MessageAttrsWithReactions
 * @typedef {import('./types').MUCMessageAttrsWithReactions} MUCMessageAttrsWithReactions
 * @typedef {import('../../shared/types').ChatBoxOrMUC} ChatBoxOrMUC
 * @typedef {import('../../shared/message').default} BaseMessage
 */

/**
 * Hook handler for the `getDuplicateMessageQueries` hook.
 *
 * Adds query objects so that incoming reaction stanzas can be matched against
 * the message they target. Per XEP-0444, the `<reactions id="...">` attribute
 * contains the id of the original message. Different clients use different id
 * types for this reference:
 *
 * - The sender's client-assigned stanza id (`msgid` / `origin_id`).
 * - The MUC-assigned stanza_id (`stanza_id <muc-jid>`), as used by Conversations
 *   and other compliant clients.
 *
 * By contributing all three query objects here we ensure a single O(n) scan
 * in {@link getDuplicateMessage} covers all cases, with no reaction-specific
 * logic leaking into shared code.
 *
 * @param {ChatBoxOrMUC} chatbox
 * @param {MessageAttrsWithReactions|MUCMessageAttrsWithReactions} attrs
 * @param {object[]} queries
 * @returns {object[]}
 */
export function getDuplicateMessageQueries(chatbox, attrs, queries) {
    const reaction_to_id = /** @type {string|undefined} */ (attrs.reaction_to_id);
    if (!reaction_to_id) return queries;

    /** @type {object[]} */
    const extra = [{ origin_id: reaction_to_id }, { msgid: reaction_to_id }];

    if (chatbox.get('type') === 'chatroom') {
        extra.push({ [`stanza_id ${chatbox.get('jid')}`]: reaction_to_id });
    }

    return [...queries, ...extra];
}

export function registerPEPPushHandler() {
    const bare_jid = _converse.session.get('bare_jid');
    api.connection.get().addHandler(
        /** @param {Element} stanza */
        (stanza) => {
            const { popular_reactions } = _converse.state;
            popular_reactions?.applyPopularReactionsFromStanza(stanza);
            return true;
        },
        Strophe.NS.REACTIONS_POPULAR,
        'message',
        'headline',
        null,
        bare_jid,
    );
}

/**
 * @returns {import('shared/types').StorageKeys}
 */
export function getStorageKeys() {
    const { session } = _converse;
    const storage_key = `converse.popular_reactions_frequencies.${session.get('bare_jid')}`;
    const fetched_flag_key = `${storage_key}-fetched`;
    return { storage_key, fetched_flag_key };
}

/**
 * Clear the popular reactions session data.
 */
export function clearSession() {
    delete _converse.state.popular_reactions;
}

/**
 * This hook handler merges the incoming single-reactor reactions
 * with all existing reactions from other reactors, so that no
 * reactions are lost when the message is saved. Keys are
 * occupant_id, bare JID, or full JID depending on the context
 * (see {@link parseReactionsMessage} for the priority chain).
 *
 * @param {BaseMessage} message
 * @param {MessageAttributes|MUCMessageAttributes} new_attrs
 * @param {MessageAttrsWithReactions|MUCMessageAttrsWithReactions} original_attrs
 * @returns {MessageAttrsWithReactions|MUCMessageAttrsWithReactions} - Updated attributes
 */
export function getUpdatedMessageAttributes(message, new_attrs, original_attrs) {
    const incoming_reactions = original_attrs?.reactions;
    if (!incoming_reactions) return new_attrs;

    const reactions = { ...(message.get('reactions') || {}) };

    for (const key in incoming_reactions) {
        if (incoming_reactions[key]?.length) {
            reactions[key] = incoming_reactions[key];
        } else {
            delete reactions[key];
        }
    }
    return { ...new_attrs, reactions };
}

/**
 * Handler for the getErrorAttributesForMessage hook.
 *
 * When a reaction fails to send (e.g., due to a server error or stanza timeout),
 * this hook ensures that the user's own reaction is not preserved locally as if
 * it had been delivered successfully.
 *
 * It removes the current user's reaction from the message's reactions map,
 * so that the UI will not show a local-only reaction that failed to reach
 * the recipient.
 *
 * @param {BaseMessage} message
 * @param {MessageAttrsWithReactions|MUCMessageAttrsWithReactions} new_attrs
 * @param {MessageAttrsWithReactions|MUCMessageAttrsWithReactions} original_attrs
 * @returns {MessageAttrsWithReactions|MUCMessageAttrsWithReactions}
 */
export function getErrorAttributesForMessage(message, new_attrs, original_attrs) {
    if (original_attrs.reaction_to_id) {
        const chatbox = message.collection?.chatbox;
        const my_key = chatbox ? getOwnReactionJID(chatbox) : Strophe.getBareJidFromJid(api.connection.get().jid);
        const reactions = { ...message.get('reactions') };
        delete reactions[my_key];
        new_attrs.reactions = reactions;
    }
    return new_attrs;
}

/**
 * Handler for the beforeMessageCreated hook.
 *
 * When a reaction stanza arrives for a message that isn't in local
 * state yet (e.g. during MAM catch-up where messages arrive out of
 * order), store it as a dangling reaction so it can be applied once
 * the original message arrives.
 *
 * @param {ChatBoxOrMUC} chatbox
 * @param {MessageAttrsWithReactions|MUCMessageAttrsWithReactions} attrs
 * @param {{handled: boolean}} data - The hook data object
 * @returns {{handled: boolean}} - Updated hook data
 */
export function onBeforeMessageCreated(chatbox, attrs, data) {
    if (!attrs.reaction_to_id) return data;

    // If the target message already exists, the normal getDuplicateMessage
    // flow will have matched it and updateMessage will be called instead
    // so we only reach here if the target is missing.
    attrs.dangling_reaction = true;
    chatbox.createMessage(attrs);
    return { ...data, handled: true };
}

/**
 * Handler for the afterMessageCreated hook.
 *
 * When a new message is created, check whether any dangling reactions
 * were waiting for it. If so, merge their reactions onto the new
 * message and destroy the placeholders.
 *
 * @param {ChatBoxOrMUC} chatbox
 * @param {BaseMessage} message - The newly created message model
 */
export async function onAfterMessageCreated(chatbox, message) {
    const msgid = message.get('msgid');
    const origin_id = message.get('origin_id');

    // Collect all stanza_id values from the new message so we can match dangling
    // reactions that reference the message by its server-assigned stanza_id
    // (e.g. as sent by Conversations and other XEP-0444 compliant MUC clients).
    const stanza_id_values = Object.keys(message.attributes)
        .filter((k) => k.startsWith('stanza_id '))
        .map((k) => message.get(k))
        .filter(Boolean);

    if (!msgid && !origin_id && !stanza_id_values.length) return;

    const danglings = chatbox.messages.models.filter((m) => {
        if (!m.get('dangling_reaction')) return false;
        const reaction_to_id = m.get('reaction_to_id');
        return reaction_to_id === msgid || reaction_to_id === origin_id || stanza_id_values.includes(reaction_to_id);
    });
    if (!danglings.length) return;

    const reactions = { ...(message.get('reactions') || {}) };
    for (const dangling of danglings) {
        const incoming = dangling.get('reactions') || {};
        for (const jid in incoming) {
            if (incoming[jid]?.length) {
                reactions[jid] = incoming[jid];
            } else {
                delete reactions[jid];
            }
        }
        dangling.destroy();
    }
    message.save({ reactions });
}

/**
 * Returns the key under which the current user's reactions are stored
 * on a given message's `reactions` map.
 *
 * The key follows the same priority chain used when parsing incoming
 * reaction stanzas ({@link parseReactionsMessage}):
 *
 * 1. **occupant_id** (XEP-0421) — stable across nick changes, works in all
 *    MUC anonymity modes.
 * 2. **real bare JID** — used only when the MUC is non-anonymous (every
 *    participant can see real JIDs), to avoid inconsistency in semi-anonymous
 *    rooms where only moderators see real JIDs.
 * 3. **full JID** (`room@domain/nick`) — last-resort fallback.
 *
 * For 1:1 chats the key is always the own bare JID.
 *
 * @param {ChatBoxOrMUC} chatbox
 * @returns {string}
 */
export function getOwnReactionJID(chatbox) {
    if (chatbox.get('type') === 'chatroom') {
        if (chatbox.get('occupant_id')) {
            return chatbox.get('occupant_id');
        }
        if (chatbox.features?.get('nonanonymous')) {
            return _converse.session.get('bare_jid');
        }
        return `${chatbox.get('jid')}/${chatbox.get('nick')}`;
    }
    return Strophe.getBareJidFromJid(api.connection.get().jid);
}

/**
 * Convert a unicode emoji string to its codepoint key as used in the emoji data
 * (e.g. '❤️' → '2764', '👍' → '1f44d').
 * Variation selectors (U+FE0F, U+FE0E) are stripped since the emoji data keys
 * do not include them.
 * @param {string} emoji
 * @returns {string}
 */
export function emojiToCodepointKey(emoji) {
    return [...emoji]
        .filter((c) => c.codePointAt(0) !== 0xfe0f && c.codePointAt(0) !== 0xfe0e)
        .map((c) => c.codePointAt(0).toString(16))
        .join('-');
}

/**
 * Publish the given list of emoji+timestamp pairs as the user's popular reactions
 * to their private PEP node (XEP-0223). Timestamps follow the XEP-0082 datetime
 * profile (ISO 8601 UTC), as used by XEP-0203 delayed delivery.
 *
 * @param {Array<{emoji: string, stamp: string}>} reactions - Emoji/timestamp pairs to store, sorted most-recent first
 */
export async function publishPopularReactions(reactions) {
    const item = stx`
        <item id="current">
            <popular-reactions xmlns="${Strophe.NS.REACTIONS_POPULAR}">
                ${reactions.map(({ emoji, stamp }) => stx`<reaction stamp="${stamp}">${emoji}</reaction>`)}
            </popular-reactions>
        </item>`;

    try {
        await api.pubsub.publish(null, Strophe.NS.REACTIONS_POPULAR, item, {
            'persist_items': 'true',
            'access_model': 'whitelist',
        });
    } catch (e) {
        log.warn('publishPopularReactions: failed to update popular reactions');
        log.error(e);
    }
}

Object.assign(u, {
    reactions: {
        ...u.reactions,
        emojiToCodepointKey,
        getOwnReactionJID,
        publishPopularReactions,
    },
});
