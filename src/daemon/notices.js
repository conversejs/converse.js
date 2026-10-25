/**
 * What the owner is told about drafts, as messages from the agent's account.
 * The agent's text is quoted as a JSON string, so where it starts and ends is
 * unambiguous. Kept free of imports so that the drafts and messages modules
 * can both use it.
 * @module @converse/daemon/notices
 */

/**
 * How much of a message a notice quotes, to say which one a draft is about.
 */
const QUOTE_LENGTH = 100;

/**
 * @param {import('./types').Draft} draft
 * @param {import('./types').MessageDTO|null} [target] - The message the draft replies or reacts to
 * @returns {string}
 */
export function draftNotice({ id, to, body, consumer, action }, target) {
    let how = 'To send it, copy the text into your client';
    if (target && action === 'react') how = `To send it, react to ${describe(target)}, with`;
    else if (target) how = `To send it as a reply to ${describe(target)}, copy the text into your client`;
    return `Draft ${id} for ${to}, from ${consumer ?? 'an agent'}. Nothing was sent. ${how}:\n${JSON.stringify(body)}`;
}

/**
 * Which message a draft is about: who sent it, and the start of its text.
 * @param {import('./types').MessageDTO} message
 */
function describe({ from, nick, body }) {
    const chars = [...(body ?? '')];
    const text = chars.length > QUOTE_LENGTH ? chars.slice(0, QUOTE_LENGTH).join('') + '…' : chars.join('');
    return `the message from ${nick ?? from}, ${JSON.stringify(text)}`;
}

/**
 * @param {string} id
 * @returns {string}
 */
export function withdrawalNotice(id) {
    return `Draft ${id} was withdrawn. Nothing was sent.`;
}
