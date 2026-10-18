import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { getUniqueId } from '../../utils/index.js';
import { isCarbon } from '../../shared/parsers.js';
import Call from './model.js';
import { buildPropose, buildReject, buildRetract, buildRinging, parseJMI } from './jmi.js';
import { endCallFromTerminate } from './rtp.js';
import { CALL_DIRECTION, CALL_STATES, ENDED_REASONS, RING_TIMEOUT } from './constants.js';

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

    const bare_jid = Strophe.getBareJidFromJid(jid).toLowerCase();
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
 * Mutual `<propose>` (glare): the lower session id wins, in i;octet order
 * (XEP-0353 § 9.1). The loser retracts its own call and the winner rejects the
 * other one, both marked as a tie-break.
 * @param {import('./model.js').default} ours - our unanswered outgoing call to the same peer
 * @param {string} their_sid
 * @param {string} from - the full JID that sent the other `<propose>`
 * @returns {boolean} true if the incoming propose should be honoured (we lost)
 */
function resolveGlare(ours, their_sid, from) {
    if (their_sid < ours.sid) {
        api.send(buildRetract(ours.peer, ours.sid, { tie_break: true }));
        ours.end(ENDED_REASONS.CANCELLED);
        return true;
    }
    api.send(buildReject(from, their_sid, { tie_break: true }));
    return false;
}

/**
 * Whether a call from `bare_jid` may ring: anyone's, when strangers may message
 * us, otherwise only a roster contact's that isn't just a subscription request.
 * @param {string} bare_jid
 * @returns {boolean}
 */
function mayRing(bare_jid) {
    if (api.settings.get('allow_non_roster_messaging')) return true;

    const contact = _converse.state.roster?.get(bare_jid);
    return !!contact && !contact.get('requesting');
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

    // JMI is one-to-one; a room occupant must not be able to drive our calls.
    if (!msg || msg.getAttribute('type') === 'groupchat') return true;

    const data = parseJMI(msg);
    if (!data) return true;

    const { action, sid, from, media, delayed_by } = data;
    const { calls } = _converse.state;
    // Bare JIDs are compared, and stored in the roster, lowercased.
    const bare_from = Strophe.getBareJidFromJid(from).toLowerCase();
    const is_carbon = bare_from === _converse.session.get('bare_jid');
    // Our own `<accept>` is addressed to our bare JID so sibling devices stop
    // ringing, but the server routes it back to this device too. A real sibling
    // action carries that sibling's full JID; ours carries our own. Without this
    // we'd tear down the very call we just accepted as "answered elsewhere".
    const is_self = from === _converse.session.get('jid');

    let call = calls.get(sid);
    // Session ids are not secret, so only the call's own peer may act on it.
    const from_peer = !!call && bare_from === call.get('jid');
    const from_sibling = is_carbon && !is_self;
    // Each answer only means something while the call still waits for one. A
    // later copy (e.g. a <proceed> crossing our own hangup) must not revive it.
    const state = call?.get('state');
    const direction = call?.get('direction');
    const outgoing_unanswered =
        direction === CALL_DIRECTION.OUTGOING && [CALL_STATES.CALLING, CALL_STATES.RINGING].includes(state);
    const incoming_ringing = direction === CALL_DIRECTION.INCOMING && state === CALL_STATES.RINGING;

    switch (action) {
        case 'propose': {
            if (is_carbon || call) break; // our own propose echoed back, or a duplicate
            if (delayed_by > RING_TIMEOUT) break; // held offline until after the caller gave up
            if (!mayRing(bare_from)) break;

            // Answering automatically tells the caller that we are online, so
            // only do it when they see our presence anyway (XEP-0353 Security
            // Considerations).
            const may_answer = !!_converse.state.roster?.get(bare_from)?.seesOurPresence();
            if (!media.length) {
                if (may_answer) api.send(buildReject(from, sid)); // nothing in it that we support
                break;
            }

            const live = getLiveCall();
            if (live) {
                const glare =
                    live.get('jid') === bare_from &&
                    live.get('direction') === CALL_DIRECTION.OUTGOING &&
                    [CALL_STATES.CALLING, CALL_STATES.RINGING].includes(live.get('state'));
                if (glare) {
                    if (!resolveGlare(live, sid, from)) break;
                } else {
                    if (may_answer) api.send(buildReject(from, sid)); // busy with someone/something else
                    break;
                }
            }

            call = new Call({
                id: sid,
                jid: bare_from,
                full_jid: from, // the caller's resource; replies must be addressed here
                direction: CALL_DIRECTION.INCOMING,
                state: CALL_STATES.RINGING,
                media,
            });
            calls.add(call);
            api.trigger('callInvited', call);
            if (may_answer) api.send(buildRinging(from, sid));
            break;
        }
        case 'ringing':
            if (from_peer && direction === CALL_DIRECTION.OUTGOING && state === CALL_STATES.CALLING) {
                call.set('state', CALL_STATES.RINGING);
            }
            break;
        case 'proceed':
            if (from_sibling && incoming_ringing) {
                call.end(ENDED_REASONS.ANSWERED_ELSEWHERE);
            } else if (from_peer && outgoing_unanswered) {
                call.set('state', CALL_STATES.CONNECTING);
                call.startSession(from); // the proceed's full JID is the peer we negotiate with
            }
            break;
        case 'accept':
            // A sibling device answered an incoming call we're also ringing for
            // (our own accept echo is filtered out by `is_self`).
            if (from_sibling && incoming_ringing) {
                call.end(ENDED_REASONS.ANSWERED_ELSEWHERE);
            }
            break;
        case 'reject':
            if (from_sibling && incoming_ringing) {
                call.end(ENDED_REASONS.ANSWERED_ELSEWHERE);
            } else if (from_peer && outgoing_unanswered) {
                call.end(ENDED_REASONS.DECLINED);
            }
            break;
        case 'retract':
            // Once a session exists the caller ends it with session-terminate instead.
            if (from_peer && direction === CALL_DIRECTION.INCOMING && call.isPreActive() && !call.session) {
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
function buildUnknownSession(iq) {
    return stx`
        <iq xmlns="jabber:client" type="error" to="${iq.getAttribute('from')}" id="${iq.getAttribute('id')}">
            <error type="cancel">
                <item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                <unknown-session xmlns="${Strophe.NS.JINGLE_ERRORS}"/>
            </error>
        </iq>`;
}

/**
 * @param {Element} iq
 * @param {'feature-not-implemented'|'unsupported-info'} refusal
 */
function buildNotImplemented(iq, refusal) {
    const jingle_condition =
        refusal === 'unsupported-info' ? stx`<unsupported-info xmlns="${Strophe.NS.JINGLE_ERRORS}"/>` : '';
    return stx`
        <iq xmlns="jabber:client" type="error" to="${iq.getAttribute('from')}" id="${iq.getAttribute('id')}">
            <error type="cancel">
                <feature-not-implemented xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                ${jingle_condition}
            </error>
        </iq>`;
}

/** @param {Element} iq */
function buildOutOfOrder(iq) {
    return stx`
        <iq xmlns="jabber:client" type="error" to="${iq.getAttribute('from')}" id="${iq.getAttribute('id')}">
            <error type="cancel">
                <unexpected-request xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                <out-of-order xmlns="${Strophe.NS.JINGLE_ERRORS}"/>
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
    const from = iq.getAttribute('from');
    const call = _converse.state.calls?.get(jingle.getAttribute('sid'));

    // Only the resource that proposed the call may start its session. The
    // `initiator` attribute is the sender's own claim, so it isn't trusted.
    if (action === 'session-initiate' && call && !isTerminal(call)) {
        if (from === (call.session?.peer_jid ?? call.peer_full_jid)) {
            // Answering captures the microphone, so it waits for the user to
            // accept, and happens once. We start outgoing sessions ourselves.
            const answerable =
                call.get('direction') === CALL_DIRECTION.INCOMING &&
                call.get('state') === CALL_STATES.CONNECTING &&
                !call.session;
            if (!answerable) {
                api.send(buildOutOfOrder(iq));
                return true;
            }
            call.answerSession(from);
        }
    }

    // The caller may end an accepted call before it starts the session.
    if (action === 'session-terminate' && call && !call.session && !isTerminal(call) && from === call.peer_full_jid) {
        endCallFromTerminate(call, jingle);
        api.send(buildIqResult(iq));
        return true;
    }

    // Anyone other than the session's peer is told the session doesn't exist,
    // so session ids can't be probed.
    const session = call?.session;
    if (!session || from !== session.peer_jid) {
        api.send(buildUnknownSession(iq));
        return true;
    }

    const refusal = session.refusal(action, jingle);
    if (refusal) {
        api.send(buildNotImplemented(iq, refusal));
        return true;
    }
    api.send(buildIqResult(iq));
    session.handleJingle(action, jingle);
    return true;
}

let handler_refs = [];

/** Register the inbound JMI + Jingle-IQ handlers on the connection (re-run on (re)connect). */
export function registerCallHandlers() {
    // A reconnection keeps the old handlers, so replace them rather than add a second set.
    unregisterCallHandlers();
    const connection = api.connection.get();
    handler_refs = [
        connection.addHandler(handleJingleMessage, Strophe.NS.JINGLE_MESSAGE, 'message'),
        connection.addHandler(handleJingleIq, Strophe.NS.JINGLE, 'iq', 'set'),
    ];
}

export function unregisterCallHandlers() {
    const connection = api.connection.get();
    handler_refs.forEach((ref) => connection?.deleteHandler(ref));
    handler_refs = [];
}
