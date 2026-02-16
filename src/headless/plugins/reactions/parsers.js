/**
 * @typedef {import('../../shared/types').MessageAttributes} MessageAttributes
 * @typedef {import('../../plugins/muc/types').MUCMessageAttributes} MUCMessageAttributes
 */

import converse from '../../shared/api/public.js';

const { Strophe } = converse.env;

/**
 * Parse reactions from a message stanza and return updated attributes
 * @param {Element} stanza - The XMPP message stanza
 * @param {MessageAttributes|MUCMessageAttributes} attrs - Current message attributes
 * @returns {Promise<import('./types').MessageAttrsWithReactions|import('./types').MUCMessageAttrsWithReactions>}
 */
export async function parseReactionsMessage(stanza, attrs) {
    const reactions_element = stanza.querySelector(
        `reactions[xmlns="${Strophe.NS.REACTIONS}"]`
    );
    
    if (!reactions_element) {
        return attrs;
    }

    const id = reactions_element.getAttribute('id');
    if (!id) {
        return attrs;
    }

    const reaction_elements = reactions_element.getElementsByTagName('reaction');
    const emojis = Array.from(reaction_elements)
        .map(el => el.textContent)
        .filter(e => e);

    if (emojis.length === 0) {
        return attrs;
    }

    const reactions = { ...(/** @type {any} */(attrs).reactions || {}) };
    const reacting_jid = attrs.from;

    emojis.forEach(emoji => {
        if (!reactions[emoji]) {
            reactions[emoji] = [];
        }
        if (!reactions[emoji].includes(reacting_jid)) {
            reactions[emoji].push(reacting_jid);
        }
    });

    // Remove user's reactions that aren't in the new emoji list
    for (const emoji in reactions) {
        if (!emojis.includes(emoji)) {
            reactions[emoji] = reactions[emoji].filter(jid => jid !== reacting_jid);
            if (reactions[emoji].length === 0) {
                delete reactions[emoji];
            }
        }
    }

    return Object.assign(attrs, { reactions });
}
