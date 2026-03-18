/**
 * @typedef {import('../../shared/types').MessageAttributes} MessageAttributes
 * @typedef {import('../../plugins/muc/types').MUCMessageAttributes} MUCMessageAttributes
 */

import converse from '../../shared/api/public.js';

const { Strophe } = converse.env;

/**
 * Parse reactions from a message stanza and return updated attributes.
 *
 * Per XEP-0444, a reaction stanza references an existing message via
 * `<reactions id="...">`. This parser extracts the referenced message ID
 * and creates a reactions object keyed by the reacting JID (since each
 * incoming reaction stanza only contains reactions from a single JID).
 *
 * The reactions object uses JIDs as keys and arrays of emoji strings as
 * values: `{ [jid]: [emoji1, emoji2, ...] }`.
 *
 * Later, when the message attributes are applied to the original message,
 * the `getUpdatedMessageAttributes` hook merges this single-JID object
 * with existing reactions from other JIDs.
 *
 * @param {Element} stanza - The XMPP message stanza
 * @param {MessageAttributes|MUCMessageAttributes} attrs - Current message attributes
 * @returns {Promise<import('./types').MessageAttrsWithReactions|import('./types').MUCMessageAttrsWithReactions>}
 */
export async function parseReactionsMessage(stanza, attrs) {
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

    const reacting_jid = attrs.type === 'groupchat' ? attrs.from : Strophe.getBareJidFromJid(attrs.from);
    const reactions = { [reacting_jid]: emojis };

    return Object.assign(attrs, {
        reaction_to_id: id,
        reactions,
    });
}
