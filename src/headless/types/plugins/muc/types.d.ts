import { CHAT_STATES } from '../../shared/constants';
import { MessageAttributes } from '../chat/types';
export type DefaultMUCAttributes = {
    bookmarked: boolean;
    chat_state: typeof CHAT_STATES;
    has_activity: boolean;
    hidden: boolean;
    hidden_occupants: boolean;
    message_type: 'groupchat';
    name: string;
    num_unread: number;
    num_unread_general: number;
    roomconfig: Object;
    time_opened: number;
    time_sent: string;
    type: 'chatroom';
};
export type MUCAttributes = DefaultMUCAttributes & {
    jid: string;
    nick: string;
    password: string;
};
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