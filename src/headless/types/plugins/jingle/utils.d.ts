/** The single live (non-terminal) call, if any - calls are one-at-a-time. */
export function getLiveCall(): any;
/**
 * Start an outgoing audio call. Calls are one at a time: dialling the peer of
 * the live call returns that call, and dialling anyone else returns null.
 * @param {string} jid - the peer to call (bare or full)
 * @returns {import('./model.js').default|null}
 */
export function dial(jid: string): import("./model.js").default | null;
/**
 * Route one inbound XEP-0353 message to the relevant {@link Call}.
 * @param {Element} stanza
 * @returns {boolean} true so the handler stays registered
 */
export function handleJingleMessage(stanza: Element): boolean;
/**
 * Route one inbound Jingle IQ to the relevant call's {@link RTPSession} and ack it.
 * @param {Element} iq
 * @returns {boolean} true so the handler stays registered
 */
export function handleJingleIq(iq: Element): boolean;
/** Register the inbound JMI + Jingle-IQ handlers on the connection (re-run on (re)connect). */
export function registerCallHandlers(): void;
export function unregisterCallHandlers(): void;
//# sourceMappingURL=utils.d.ts.map