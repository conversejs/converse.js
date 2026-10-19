/**
 * How our end reasons map to the Jingle `<reason>` conditions (XEP-0166 § 7.4)
 * that a session-terminate and a JMI `<finish/>` carry.
 */
import converse from '../../shared/api/public.js';
import { ENDED_REASONS } from './constants.js';

const { stx } = converse.env;

// Our end reason -> the Jingle <reason> condition we send.
const REASON_ELEMENT = {
    [ENDED_REASONS.SUCCESS]: () => stx`<success/>`,
    [ENDED_REASONS.CANCELLED]: () => stx`<cancel/>`,
    [ENDED_REASONS.DECLINED]: () => stx`<decline/>`,
    [ENDED_REASONS.NO_MEDIA]: () => stx`<media-error/>`,
    [ENDED_REASONS.CONNECTIVITY_ERROR]: () => stx`<connectivity-error/>`,
    [ENDED_REASONS.FAILED_APPLICATION]: () => stx`<failed-application/>`,
};

/**
 * @param {string} reason - one of {@link ENDED_REASONS}
 * @returns {import('strophe.js').Builder} the Jingle condition to send for it
 */
export function reasonCondition(reason) {
    return (REASON_ELEMENT[reason] ?? REASON_ELEMENT[ENDED_REASONS.SUCCESS])();
}
