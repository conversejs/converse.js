export const ACTION_INFO_CODES: string[];
export const NEW_NICK_CODES: string[];
export const ADMIN_COMMANDS: string[];
export const AFFILIATIONS: string[];
export const DISCONNECT_CODES: string[];
export const MODERATOR_COMMANDS: string[];
export const OWNER_COMMANDS: string[];
export const ROLES: string[];
export const VISITOR_COMMANDS: string[];
export const STATUS_CODE_STANZAS: {
    '100': string[];
    '101': string[];
    '102': string[];
    '103': string[];
    '104': string[];
    '110': string[];
    '170': string[];
    '171': string[];
    '172': string[];
    '173': string[];
    '174': string[];
    '201': string[];
    '210': string[];
    '301': string[];
    '303': string[];
    '307': string[];
    '321': string[];
    '322': string[];
    '332': string[];
    '333': string[];
};
export namespace MUC_ROLE_WEIGHTS {
    let moderator: number;
    let participant: number;
    let visitor: number;
    let none: number;
}
export namespace AFFILIATION_CHANGES {
    let OWNER: string;
    let ADMIN: string;
    let MEMBER: string;
    let EXADMIN: string;
    let EXOWNER: string;
    let EXOUTCAST: string;
    let EXMEMBER: string;
}
export const AFFILIATION_CHANGES_LIST: string[];
export namespace MUC_TRAFFIC_STATES {
    let ENTERED: string;
    let EXITED: string;
}
export const MUC_TRAFFIC_STATES_LIST: string[];
export namespace MUC_ROLE_CHANGES {
    let OP: string;
    let DEOP: string;
    let VOICE: string;
    let MUTE: string;
}
export const MUC_ROLE_CHANGES_LIST: string[];
export namespace INFO_CODES {
    let visibility_changes: string[];
    let self: string[];
    let non_privacy_changes: string[];
    let muc_logging_changes: string[];
    let nickname_changes: string[];
    let disconnected: string[];
    let affiliation_changes: string[];
    let join_leave_events: string[];
    let role_changes: string[];
}
export namespace ROOMSTATUS {
    export let CONNECTED: number;
    export let CONNECTING: number;
    export let NICKNAME_REQUIRED: number;
    export let PASSWORD_REQUIRED: number;
    export let DISCONNECTED: number;
    let ENTERED_1: number;
    export { ENTERED_1 as ENTERED };
    export let DESTROYED: number;
    export let BANNED: number;
    export let CLOSING: number;
}
export const ROOM_FEATURES: string[];
export const MUC_NICK_CHANGED_CODE: "303";
//# sourceMappingURL=constants.d.ts.map