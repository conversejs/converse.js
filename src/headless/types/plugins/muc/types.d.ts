import { MessageAttributes } from '../chat/types';
type ExtraMUCAttributes = {
    activities: Array<Object>;
    from_muc: string;
    from_real_jid: string;
    moderated: string;
    moderated_by: string;
    moderated_id: string;
    moderation_reason: string;
    occupant_id: string;
};
export type MUCMessageAttributes = MessageAttributes & ExtraMUCAttributes;
/**
 * Either the JID or the nickname (or both) will be available.
 */
export type MemberListItem = {
    affiliation: string;
    role?: string;
    jid?: string;
    nick?: string;
};
/**
 * Object representing a XEP-0371 Hat
 */
export type MUCHat = {
    title: string;
    uri: string;
};
export type MUCPresenceAttributes = {
    show: string;
    hats: Array<MUCHat>;
    states: Array<string>;
    from: string;
    nick: string;
    occupant_id: string;
    type: string;
    jid?: string;
    is_me?: boolean;
};
export {};
//# sourceMappingURL=types.d.ts.map