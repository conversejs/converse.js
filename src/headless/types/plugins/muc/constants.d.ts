export const ROLES: string[];
export const AFFILIATIONS: string[];
export namespace MUC_ROLE_WEIGHTS {
    const moderator: number;
    const participant: number;
    const visitor: number;
    const none: number;
}
export namespace AFFILIATION_CHANGES {
    const OWNER: string;
    const ADMIN: string;
    const MEMBER: string;
    const EXADMIN: string;
    const EXOWNER: string;
    const EXOUTCAST: string;
    const EXMEMBER: string;
}
export const AFFILIATION_CHANGES_LIST: string[];
export namespace MUC_TRAFFIC_STATES {
    const ENTERED: string;
    const EXITED: string;
}
export const MUC_TRAFFIC_STATES_LIST: string[];
export namespace MUC_ROLE_CHANGES {
    const OP: string;
    const DEOP: string;
    const VOICE: string;
    const MUTE: string;
}
export const MUC_ROLE_CHANGES_LIST: string[];
export namespace INFO_CODES {
    const visibility_changes: string[];
    const self: string[];
    const non_privacy_changes: string[];
    const muc_logging_changes: string[];
    const nickname_changes: string[];
    const disconnected: string[];
    const affiliation_changes: string[];
    const join_leave_events: string[];
    const role_changes: string[];
}
export namespace ROOMSTATUS {
    export const CONNECTED: number;
    export const CONNECTING: number;
    export const NICKNAME_REQUIRED: number;
    export const PASSWORD_REQUIRED: number;
    export const DISCONNECTED: number;
    const ENTERED_1: number;
    export { ENTERED_1 as ENTERED };
    export const DESTROYED: number;
    export const BANNED: number;
    export const CLOSING: number;
}
export const ROOM_FEATURES: string[];
export const MUC_NICK_CHANGED_CODE: "303";
//# sourceMappingURL=constants.d.ts.map