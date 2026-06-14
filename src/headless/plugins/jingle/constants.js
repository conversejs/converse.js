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
    ANSWERED_ELSEWHERE: 'answered-elsewhere',
    NO_MEDIA: 'no-media',
    CONNECTIVITY_ERROR: 'connectivity-error',
};

export const JMI_ACTIONS = {
    PROPOSE: 'propose',
    RINGING: 'ringing',
    PROCEED: 'proceed',
    REJECT: 'reject',
    RETRACT: 'retract',
    ACCEPT: 'accept',
    FINISH: 'finish',
};

export const CALL_DIRECTION = {
    INCOMING: 'incoming',
    OUTGOING: 'outgoing',
};
