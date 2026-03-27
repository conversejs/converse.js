import converse from '../../shared/api/public.js';
import api from '../../shared/api/index.js';
import _converse from '../../shared/_converse.js';
import log from '@converse/log';

const { Strophe, sizzle, stx, u } = converse.env;

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
 * @param {import('../../plugins/muc/muc.js').default | import('../../plugins/chat/model.js').default} chatbox
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
 * Parse a list of unicode emoji from a popular-reactions PubSub item
 * and update the PopularReactions model with received frequencies.
 *
 * The order in the stanza represents frequency (most frequent first),
 * so we assign weights based on position to approximate the frequency ranking.
 *
 * @param {Element} stanza - An IQ result or headline message containing the pubsub item
 * @param {import('./popular-model.js').default} [popular_reactions] - Optional model for tracking frequencies
 */
function applyPopularReactionsFromStanza(stanza, popular_reactions) {
    const item =
        sizzle(`items[node="${Strophe.NS.REACTIONS_POPULAR}"] item`, stanza).pop() ?? sizzle(`item`, stanza).pop();
    if (!item) return;

    const popular_el = item.querySelector(`popular-reactions[xmlns="${Strophe.NS.REACTIONS_POPULAR}"]`);
    if (!popular_el) return;

    const emojis = Array.from(popular_el.querySelectorAll('reaction'))
        .map((el) => el.textContent?.trim())
        .filter(Boolean);

    if (!emojis.length) return;

    // Update the PopularReactions model if provided
    if (popular_reactions) {
        try {
            // Convert unicode emojis to shortnames for frequency tracking
            const by_cp = u.getEmojisByAttribute('cp');
            const shortnames = emojis.map((emoji) => {
                // Convert unicode string to codepoint key (e.g. '👍' → '1f44d')
                const cp = [...emoji].map((c) => c.codePointAt(0).toString(16)).join('-');
                return by_cp[cp]?.sn ?? emoji;
            });

            // The order represents frequency (most frequent first), so we assign
            // weights based on position to approximate the frequency ranking
            const frequencies = {};
            shortnames.forEach((shortname, index) => {
                // Use a decaying weight: position 0 gets max weight, later positions get less
                const weight = shortnames.length - index;
                frequencies[shortname] = weight;
            });
            popular_reactions.setFrequencies(frequencies);
        } catch (e) {
            log.warn('applyPopularReactionsFromStanza: could not update frequencies in model', e);
        }
    }
}

/**
 * Fetch the user's stored popular reactions from their PEP node and apply them.
 * If no item is stored, the default `popular_reactions` setting is left unchanged.
 *
 * @param {import('./popular-model.js').default} [popular_reactions] - Optional model for tracking frequencies
 */
async function fetchPopularReactions(popular_reactions) {
    const bare_jid = _converse.session.get('bare_jid');

    let iq;
    try {
        iq = await api.sendIQ(
            stx`<iq type="get" from="${bare_jid}" to="${bare_jid}" xmlns="jabber:client">
                <pubsub xmlns="${Strophe.NS.PUBSUB}">
                    <items node="${Strophe.NS.REACTIONS_POPULAR}" max_items="1"/>
                </pubsub>
            </iq>`,
        );
    } catch (e) {
        // item-not-found is expected when the user has never saved a custom list
        if (e?.querySelector?.('item-not-found')) return;
        log.warn('fetchPopularReactions: could not fetch popular reactions from PubSub', e);
        return;
    }

    applyPopularReactionsFromStanza(iq, popular_reactions);
}

/**
 * Publish the given list of unicode emojis as the user's popular reactions
 * to their private PEP node (XEP-0223).
 *
 * @param {string[]} emojis - Unicode emoji strings to store
 */
export async function publishPopularReactions(emojis) {
    const item = stx`
        <item xmlns="${Strophe.NS.PUBSUB}" id="current">
            <popular-reactions xmlns="${Strophe.NS.REACTIONS_POPULAR}">
                ${emojis.map((e) => stx`<reaction>${e}</reaction>`)}
            </popular-reactions>
        </item>`;

    await api.pubsub.publish(null, Strophe.NS.REACTIONS_POPULAR, item, {
        'persist_items': 'true',
        'access_model': 'whitelist',
    });
}

/**
 * On connect/reconnect, fetch the user's stored popular reactions from
 * their private PEP node and register a push handler so that updates
 * from other devices are applied immediately.
 * @param {import('./popular-model.js').default} popular_reactions - The model tracking frequencies
 */
export async function onConnected(popular_reactions) {
    const { Strophe } = converse.env;
    const bare_jid = api.connection.get().jid ? Strophe.getBareJidFromJid(api.connection.get().jid) : null;
    if (!bare_jid) return;

    // Register a handler for incoming PubSub event notifications
    // (published by another resource of this account)
    api.connection.get().addHandler(
        /** @param {Element} stanza */
        (stanza) => {
            applyPopularReactionsFromStanza(stanza, popular_reactions);
            return true;
        },
        Strophe.NS.REACTIONS_POPULAR,
        'message',
        'headline',
        null,
        bare_jid,
    );

    await fetchPopularReactions(popular_reactions);
}

Object.assign(u, {
    reactions: {
        ...u.reactions,
        getOwnReactionJID,
        publishPopularReactions,
    },
});
