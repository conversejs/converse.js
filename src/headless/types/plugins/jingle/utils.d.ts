/** The single live (non-terminal) call, if any — calls are one-at-a-time. */
export function getLiveCall(): any;
/**
 * Start an outgoing call. Calls are one-at-a-time: dialling while busy returns
 * the call already in progress.
 * @param {string} jid - the peer to call (bare or full)
 * @param {{ audio?: boolean }} [opts]
 * @returns {import('./model.js').default}
 */
export function dial(jid: string, { audio }?: {
    audio?: boolean;
}): import("./model.js").default;
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
//# sourceMappingURL=utils.d.ts.map