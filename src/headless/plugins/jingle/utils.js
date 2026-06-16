import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { getUniqueId } from '../../utils/index.js';
import { isCarbon } from '../../shared/parsers.js';
import Call from './model.js';
import { buildPropose, buildReject, buildRinging, parseJMI } from './jmi.js';
import { CALL_DIRECTION, CALL_STATES, ENDED_REASONS } from './constants.js';

const { Strophe, sizzle, stx } = converse.env;

// XEP-0353 (JMI) call signalling. These drive the `Call` models in
// `_converse.state.calls`; the models send their own stanzas via `api.send`.

/** The single live (non-terminal) call, if any - calls are one-at-a-time. */
export function getLiveCall() {
    return _converse.state.calls?.find((c) => !isTerminal(c));
}

/**
 * @param {import('./model.js').default} call
 * @returns {boolean}
 */
function isTerminal(call) {
    return [CALL_STATES.ENDED, CALL_STATES.FAILED].includes(call.get('state'));
}

/**
 * Start an outgoing call. Calls are one-at-a-time: dialling while busy returns
 * the call already in progress.
 * @param {string} jid - the peer to call (bare or full)
 * @param {{ audio?: boolean }} [opts]
 * @returns {import('./model.js').default}
 */
export function dial(jid, { audio = true } = {}) {
    const live = getLiveCall();
    if (live) return live;

    const bare_jid = Strophe.getBareJidFromJid(jid);
    const media = audio ? ['audio'] : [];
    const sid = getUniqueId();
    const call = new Call({
        id: sid,
        jid: bare_jid,
        direction: CALL_DIRECTION.OUTGOING,
        state: CALL_STATES.CALLING,
        media,
    });
    _converse.state.calls.add(call);
    api.send(buildPropose(bare_jid, sid, /** @type {('audio'|'video')[]} */ (media)));
    return call;
}

/**
 * Mutual `<propose>` (glare): both sides run the same deterministic tie-break on
 * the two session ids so they agree on a single winner. The higher sid wins.
 * @param {import('./model.js').default} ours - our outgoing call to the same peer
 * @param {string} their_sid
 * @returns {boolean} true if the incoming propose should be honoured (we lost)
 */
function resolveGlare(ours, their_sid) {
    if (their_sid > ours.get('id')) {
        ours.end(ENDED_REASONS.CANCELLED); // we lost - drop our outgoing call
        return true;
    }
    return false; // we won - ignore their propose, they'll drop it by the same rule
}

/**
 * Route one inbound XEP-0353 message to the relevant {@link Call}.
 * @param {Element} stanza
 * @returns {boolean} true so the handler stays registered
 */
export function handleJingleMessage(stanza) {
    let msg = stanza;
    if (isCarbon(stanza)) {
        // Only trust carbons forwarded by our own server: the envelope's `from`
        // must be our bare JID, else it's a forging attempt (XEP-0280 security).
        if (stanza.getAttribute('from') !== _converse.session.get('bare_jid')) return true;
        const selector = `[xmlns="${Strophe.NS.CARBONS}"] > forwarded[xmlns="${Strophe.NS.FORWARD}"] > message`;
        msg = sizzle(selector, stanza).pop();
    }

    const data = parseJMI(msg);
    if (!data) return true;

    const { action, sid, from, media } = data;
    const { calls } = _converse.state;
    const bare_from = Strophe.getBareJidFromJid(from);
    const is_carbon = bare_from === _converse.session.get('bare_jid');
    let call = calls.get(sid);

    switch (action) {
        case 'propose': {
            if (is_carbon || call) break; // our own propose echoed back, or a duplicate

            const live = getLiveCall();
            if (live) {
                if (live.get('jid') === bare_from && live.get('direction') === CALL_DIRECTION.OUTGOING) {
                    if (!resolveGlare(live, sid)) break; // we won the glare; ignore theirs
                } else {
                    api.send(buildReject(bare_from, sid)); // busy with someone/something else
                    break;
                }
            }

            call = new Call({
                id: sid,
                jid: bare_from,
                direction: CALL_DIRECTION.INCOMING,
                state: CALL_STATES.RINGING,
                media,
            });
            calls.add(call);
            api.trigger('callInvited', call);
            api.send(buildRinging(bare_from, sid));
            break;
        }
        case 'ringing':
            if (call?.get('direction') === CALL_DIRECTION.OUTGOING) {
                call.set('state', CALL_STATES.RINGING);
            }
            break;
        case 'proceed':
            if (is_carbon) {
                call?.end(ENDED_REASONS.ANSWERED_ELSEWHERE);
            } else if (call?.get('direction') === CALL_DIRECTION.OUTGOING) {
                call.set('state', CALL_STATES.CONNECTING);
                call.startSession(from); // the proceed's full JID is the peer we negotiate with
            }
            break;
        case 'accept':
            // A sibling device answered an incoming call we're also ringing for.
            if (is_carbon && call?.get('direction') === CALL_DIRECTION.INCOMING) {
                call.end(ENDED_REASONS.ANSWERED_ELSEWHERE);
            }
            break;
        case 'reject':
            if (is_carbon) {
                call?.end(ENDED_REASONS.ANSWERED_ELSEWHERE);
            } else if (call?.get('direction') === CALL_DIRECTION.OUTGOING) {
                call.end(ENDED_REASONS.DECLINED);
            }
            break;
        case 'retract':
            if (call?.get('direction') === CALL_DIRECTION.INCOMING) {
                call.end(ENDED_REASONS.CANCELLED);
            }
            break;
    }
    return true;
}

/** @param {Element} iq */
function buildIqResult(iq) {
    return stx`<iq xmlns="jabber:client" type="result" to="${iq.getAttribute('from')}" id="${iq.getAttribute('id')}"/>`;
}

/** @param {Element} iq */
function buildItemNotFound(iq) {
    return stx`
        <iq xmlns="jabber:client" type="error" to="${iq.getAttribute('from')}" id="${iq.getAttribute('id')}">
            <error type="cancel">
                <item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
            </error>
        </iq>`;
}

/**
 * Route one inbound Jingle IQ to the relevant call's {@link RTPSession} and ack it.
 * @param {Element} iq
 * @returns {boolean} true so the handler stays registered
 */
export function handleJingleIq(iq) {
    const jingle = sizzle(`> jingle[xmlns="${Strophe.NS.JINGLE}"]`, iq).pop();
    if (!jingle) return true;

    const action = jingle.getAttribute('action');
    const call = _converse.state.calls?.get(jingle.getAttribute('sid'));

    if (action === 'session-initiate' && call?.isPreActive() && !call.session) {
        if (call.get('direction') !== CALL_DIRECTION.INCOMING) return true; // we initiate outgoing calls
        call.answerSession(jingle.getAttribute('initiator') || iq.getAttribute('from'));
    }

    const session = call?.session;
    if (!session) {
        api.send(buildItemNotFound(iq));
        return true;
    }

    session.handleJingle(action, jingle);
    api.send(buildIqResult(iq));
    return true;
}

/** Register the inbound JMI + Jingle-IQ handlers on the connection (re-run on (re)connect). */
export function registerCallHandlers() {
    const connection = api.connection.get();
    connection.addHandler(handleJingleMessage, Strophe.NS.JINGLE_MESSAGE, 'message');
    connection.addHandler(handleJingleIq, Strophe.NS.JINGLE, 'iq', 'set');
}
