/**
 * How our end reasons map to the Jingle `<reason>` conditions (XEP-0166 § 7.4)
 * that a session-terminate and a JMI `<finish/>` carry.
 */
import converse from '../../shared/api/public.js';
import { ENDED_REASONS } from './constants.js';

const { sizzle, stx } = converse.env;

// Our end reason -> the Jingle <reason> condition we send.
const REASON_ELEMENT = {
    [ENDED_REASONS.SUCCESS]: () => stx`<success/>`,
    [ENDED_REASONS.CANCELLED]: () => stx`<cancel/>`,
    [ENDED_REASONS.DECLINED]: () => stx`<decline/>`,
    [ENDED_REASONS.NO_MEDIA]: () => stx`<media-error/>`,
    [ENDED_REASONS.CONNECTIVITY_ERROR]: () => stx`<connectivity-error/>`,
    [ENDED_REASONS.FAILED_APPLICATION]: () => stx`<failed-application/>`,
    [ENDED_REASONS.MIGRATED]: () => stx`<expired/>`,
};

/**
 * @param {string} reason - one of {@link ENDED_REASONS}
 * @returns {import('strophe.js').Builder} the Jingle condition to send for it
 */
export function reasonCondition(reason) {
    return (REASON_ELEMENT[reason] ?? REASON_ELEMENT[ENDED_REASONS.SUCCESS])();
}

// A received Jingle <reason> condition -> our end reason.
const REASON_FROM_JINGLE = {
    success: ENDED_REASONS.SUCCESS,
    decline: ENDED_REASONS.DECLINED,
    busy: ENDED_REASONS.DECLINED,
    cancel: ENDED_REASONS.CANCELLED,
    'connectivity-error': ENDED_REASONS.CONNECTIVITY_ERROR,
    'failed-transport': ENDED_REASONS.CONNECTIVITY_ERROR,
    timeout: ENDED_REASONS.CONNECTIVITY_ERROR,
    'media-error': ENDED_REASONS.NO_MEDIA,
    'failed-application': ENDED_REASONS.FAILED_APPLICATION,
};

// End reasons that land the call in `failed` rather than `ended`.
const FAILURE_REASONS = [ENDED_REASONS.NO_MEDIA, ENDED_REASONS.CONNECTIVITY_ERROR, ENDED_REASONS.FAILED_APPLICATION];

/**
 * End a call the way the peer says it ended.
 * @param {import('./model.js').default} call
 * @param {Element} el - the peer's session-terminate `<jingle>`, or its JMI `<finish>`
 */
export function endCallFromReason(call, el) {
    // The <reason> may hold a <text/> beside its condition, so pick the condition by name.
    const condition = sizzle('reason > *', el)
        .map((child) => child.tagName)
        .find((name) => name in REASON_FROM_JINGLE);
    const reason = REASON_FROM_JINGLE[condition] ?? ENDED_REASONS.SUCCESS;
    if (FAILURE_REASONS.includes(reason)) {
        call.fail(reason);
    } else {
        call.end(reason);
    }
}
