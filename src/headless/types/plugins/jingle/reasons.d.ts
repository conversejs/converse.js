/**
 * @param {string} reason - one of {@link ENDED_REASONS}
 * @returns {import('strophe.js').Builder} the Jingle condition to send for it
 */
export function reasonCondition(reason: string): import("strophe.js").Builder;
/**
 * End a call the way the peer says it ended.
 * @param {import('./model.js').default} call
 * @param {Element} el - the peer's session-terminate `<jingle>`, or its JMI `<finish>`
 */
export function endCallFromReason(call: import("./model.js").default, el: Element): void;
//# sourceMappingURL=reasons.d.ts.map