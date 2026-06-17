import { _converse, converse, constants } from '@converse/headless';
import { __ } from 'i18n';

const { Strophe } = converse.env;
const { CALL_DIRECTION, ENDED_REASONS } = constants;

/**
 * The peer's name for the call UI. The roster contact resolves asynchronously,
 * so we fall back to the nickname and then the JID node while it's still null.
 * @param {import('@converse/headless').Call} call
 * @returns {string}
 */
export function getCallName(call) {
    const jid = call.get('jid');
    return call.contact?.getDisplayName?.() || call.get('nickname') || Strophe.getNodeFromJid(jid) || jid;
}

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
 * Human-readable reason for a call that didn't connect (or didn't end cleanly).
 * @param {string} reason - one of {@link ENDED_REASONS}
 * @returns {string}
 */
export function reasonText(reason) {
    switch (reason) {
        case ENDED_REASONS.DECLINED:
            return __('Call declined');
        case ENDED_REASONS.ANSWERED_ELSEWHERE:
            return __('Answered on another device');
        case ENDED_REASONS.CANCELLED:
            return __('Call cancelled');
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
 * The summary line shown in the call card once it's over.
 * @param {import('@converse/headless').Call} call
 * @returns {string}
 */
export function endedSummary(call) {
    const started_at = call.get('started_at');
    if (started_at) {
        const duration = formatDuration((call.get('ended_at') || Date.now()) - started_at);
        return __('Call ended · %1$s', duration);
    }
    return reasonText(call.get('ended_reason'));
}

/**
 * Write a history row into the peer's chat log when a call ends.
 * @param {import('@converse/headless').Call} call
 */
export function writeCallHistory(call) {
    const chatbox = _converse.state.chatboxes?.get(call.get('jid'));
    if (!chatbox) return;

    const incoming = call.get('direction') === CALL_DIRECTION.INCOMING;
    const started_at = call.get('started_at');

    let message;
    if (started_at) {
        const duration = formatDuration((call.get('ended_at') || Date.now()) - started_at);
        message = incoming ? __('Incoming call · %1$s', duration) : __('Outgoing call · %1$s', duration);
    } else if (incoming) {
        message = __('Missed call');
    } else {
        message = reasonText(call.get('ended_reason'));
    }
    chatbox.createMessage({ type: 'info', message });
}
