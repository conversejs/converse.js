/**
 * The line each call leaves in the peer's chat once it's over.
 */
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import { CALL_DIRECTION, ENDED_REASONS } from './constants.js';

/**
 * @param {number} ms
 * @returns {string} elapsed time as `m:ss`
 */
export function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * @param {import('./model.js').default} call
 * @returns {string|null} how long the call was connected, as `m:ss`, or null if it never was
 */
export function callDuration(call) {
    const started_at = call.get('started_at');
    return started_at ? formatDuration((call.get('ended_at') || Date.now()) - started_at) : null;
}

/**
 * Why a call didn't connect (or didn't end cleanly).
 * @param {string} reason - one of {@link ENDED_REASONS}
 * @returns {string}
 */
export function reasonText(reason) {
    const { __ } = _converse;
    switch (reason) {
        case ENDED_REASONS.DECLINED:
            return __('Call declined');
        case ENDED_REASONS.ANSWERED_ELSEWHERE:
            return __('Answered on another device');
        case ENDED_REASONS.CANCELLED:
            return __('Call cancelled');
        case ENDED_REASONS.NO_ANSWER:
            return __('No answer');
        case ENDED_REASONS.NO_MEDIA:
            return __('No microphone access');
        case ENDED_REASONS.CONNECTIVITY_ERROR:
        case ENDED_REASONS.FAILED_APPLICATION:
            return __('Call failed');
        default:
            return __('Call ended');
    }
}

/**
 * @param {import('./model.js').default} call
 * @returns {string}
 */
function historyText(call) {
    const { __ } = _converse;
    const incoming = call.get('direction') === CALL_DIRECTION.INCOMING;
    const duration = callDuration(call);
    if (duration) {
        return incoming ? __('Incoming call · %1$s', duration) : __('Outgoing call · %1$s', duration);
    }
    return call.get('missed') ? __('Missed call') : reasonText(call.get('ended_reason'));
}

/**
 * Add a line to the chat with `jid`, opening the chat if needed, as an
 * incoming message would.
 * @param {string} jid - the peer's bare JID
 * @param {string} message
 * @param {string} [time] - ISO 8601, when it happened; defaults to now
 */
async function writeToChat(jid, message, time) {
    // Calls hung up on logout end after the session is gone; there's no chat to write to.
    if (!api.connection.connected()) return;
    const chatbox = await api.chats.get(jid, {}, true);
    await chatbox?.createMessage({ type: 'info', message, ...(time ? { time } : {}) });
}

/** @param {import('./model.js').default} call */
export function writeCallHistory(call) {
    if (call.leavesNoTrace()) return;

    return writeToChat(call.peer, historyText(call));
}

/**
 * A call we never rang for, because it reached us after the caller gave up.
 * @param {string} jid - the caller's bare JID
 * @param {string} time - ISO 8601, when the call was made
 */
export function writeMissedCall(jid, time) {
    return writeToChat(jid, _converse.__('Missed call'), time);
}
