import converse from '../../shared/api/public.js';

const { Strophe } = converse.env;

/**
 * Parse reactions from a message stanza and return updated attributes.
 *
 * Per XEP-0444, a reaction stanza references an existing message via
 * `<reactions id="...">`. This parser extracts the referenced message ID
 * and creates a reactions object keyed by the reacting party's stable
 * identity key (since each incoming reaction stanza only contains reactions
 * from a single sender).
 *
 * The key used for the `reactions` map follows this priority chain for MUC:
 *
 * 1. **occupant_id** (XEP-0421) — stable across nick changes, works in all
 *    MUC anonymity modes.
 * 2. **real bare JID** (`from_real_jid`) — used only when the MUC is
 *    non-anonymous, to avoid key inconsistency in semi-anonymous rooms where
 *    only moderators can see real JIDs.
 * 3. **full JID** (`room@domain/nick`) — last-resort fallback.
 *
 * For 1:1 chats the key is always the sender's bare JID.
 *
 * Later, when the message attributes are applied to the original message,
 * the `getUpdatedMessageAttributes` hook merges this single-reactor object
 * with existing reactions from other reactors.
 *
 * @typedef {import('../../shared/types').MessageAttributes} MessageAttributes
 * @typedef {import('../../plugins/muc/types').MUCMessageAttributes} MUCMessageAttributes
 * @param {Element} stanza - The XMPP message stanza
 * @param {MessageAttributes|MUCMessageAttributes} attrs - Current message attributes
 * @param {import('../../plugins/muc/muc.js').default} [chatbox] - The MUC chatbox,
 *   passed for MUC messages so we can inspect room features (e.g. anonymity mode).
 * @returns {Promise<import('./types').MessageAttrsWithReactions|import('./types').MUCMessageAttrsWithReactions>}
 */
export async function parseReactionsMessage(stanza, attrs, chatbox) {
    const reactions_element = stanza.getElementsByTagNameNS(Strophe.NS.REACTIONS, 'reactions')[0];

    if (!reactions_element) {
        return attrs;
    }

    const id = reactions_element.getAttribute('id');
    if (!id) {
        return attrs;
    }

    const reaction_elements = reactions_element.getElementsByTagName('reaction');
    const emojis = Array.from(reaction_elements)
        .map((el) => el.textContent)
        .filter((e) => e);

    let reacting_key;
    if (attrs.type === 'groupchat') {
        const muc_attrs = /** @type {MUCMessageAttributes} */ (attrs);
        if (muc_attrs.occupant_id) {
            // XEP-0421: stable across nick changes, preferred in all MUC types
            reacting_key = muc_attrs.occupant_id;
        } else if (muc_attrs.from_real_jid && chatbox?.features?.get('nonanonymous')) {
            // Non-anonymous MUC: real bare JID is visible to all participants
            // and is stable across nick changes
            reacting_key = muc_attrs.from_real_jid;
        } else {
            // Semi-anonymous MUC without XEP-0421: fall back to full JID
            reacting_key = attrs.from;
        }
    } else {
        reacting_key = Strophe.getBareJidFromJid(attrs.from);
    }

    const reactions = { [reacting_key]: emojis };

    return Object.assign(attrs, {
        reaction_to_id: id,
        reactions,
    });
}
