import { converse } from '@converse/headless';
import { __ } from 'i18n';

const { Strophe } = converse.env;
const { callDuration, reasonText } = converse.env.jingle;

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
 * The summary line shown in the call card once it's over.
 * @param {import('@converse/headless').Call} call
 * @returns {string}
 */
export function endedSummary(call) {
    const duration = callDuration(call);
    if (duration) return __('Call ended · %1$s', duration);
    return call.get('missed') ? __('Missed call') : reasonText(call.get('ended_reason'));
}
