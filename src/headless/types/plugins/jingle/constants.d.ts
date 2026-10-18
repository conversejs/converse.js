export namespace CALL_STATES {
    let CALLING: string;
    let RINGING: string;
    let CONNECTING: string;
    let ACTIVE: string;
    let ENDED: string;
    let FAILED: string;
}
export namespace ENDED_REASONS {
    let SUCCESS: string;
    let DECLINED: string;
    let CANCELLED: string;
    let NO_ANSWER: string;
    let ANSWERED_ELSEWHERE: string;
    let NO_MEDIA: string;
    let CONNECTIVITY_ERROR: string;
    let FAILED_APPLICATION: string;
}
/** How long a call may wait for an answer, in milliseconds. */
export const RING_TIMEOUT: 60000;
/** How long an answered call may take to connect, in milliseconds. */
export const CONNECT_TIMEOUT: 30000;
export namespace JMI_ACTIONS {
    export let PROPOSE: string;
    let RINGING_1: string;
    export { RINGING_1 as RINGING };
    export let PROCEED: string;
    export let REJECT: string;
    export let RETRACT: string;
    export let ACCEPT: string;
    export let FINISH: string;
}
export namespace CALL_DIRECTION {
    let INCOMING: string;
    let OUTGOING: string;
}
//# sourceMappingURL=constants.d.ts.map