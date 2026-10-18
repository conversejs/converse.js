/**
 * Lifecycle states of a {@link Call}.
 *
 *   outgoing:  calling -> ringing -> connecting -> active -> ended | failed
 *   incoming:            ringing -> connecting -> active -> ended | failed
 */
export const CALL_STATES = {
    CALLING: 'calling',
    RINGING: 'ringing',
    CONNECTING: 'connecting',
    ACTIVE: 'active',
    ENDED: 'ended',
    FAILED: 'failed',
};

export const ENDED_REASONS = {
    SUCCESS: 'success',
    DECLINED: 'declined',
    CANCELLED: 'cancelled',
    NO_ANSWER: 'no-answer',
    ANSWERED_ELSEWHERE: 'answered-elsewhere',
    NO_MEDIA: 'no-media',
    CONNECTIVITY_ERROR: 'connectivity-error',
    FAILED_APPLICATION: 'failed-application',
};

/** How long a call may wait for an answer, in milliseconds. */
export const RING_TIMEOUT = 60_000;

/** How long an answered call may take to connect, in milliseconds. */
export const CONNECT_TIMEOUT = 30_000;

export const JMI_ACTIONS = {
    PROPOSE: 'propose',
    RINGING: 'ringing',
    PROCEED: 'proceed',
    REJECT: 'reject',
    RETRACT: 'retract',
    ACCEPT: 'accept',
};

export const CALL_DIRECTION = {
    INCOMING: 'incoming',
    OUTGOING: 'outgoing',
};
