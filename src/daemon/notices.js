/**
 * What the owner is told about drafts, as messages from the agent's account.
 * The agent's text is quoted as a JSON string, so where it starts and ends is
 * unambiguous. Kept free of imports so that the drafts and messages modules
 * can both use it.
 * @module @converse/daemon/notices
 */

/**
 * @param {import('./types').Draft} draft
 * @returns {string}
 */
export function draftNotice({ id, to, body, consumer }) {
    return (
        `Draft ${id} for ${to}, from ${consumer ?? 'an agent'}. Nothing was sent. ` +
        `To send it, copy the text into your client:\n${JSON.stringify(body)}`
    );
}

/**
 * @param {string} id
 * @returns {string}
 */
export function withdrawalNotice(id) {
    return `Draft ${id} was withdrawn. Nothing was sent.`;
}
