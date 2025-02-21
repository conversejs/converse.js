import { CHAT_STATES } from '../../shared/constants';
import { MessageAttributes } from '../../shared/types';
import MUC from './muc';
export type MUCStatusCode = '100' | '101' | '102' | '103' | '104' | '110' | '170' | '171' | '172' | '173' | '174' | '201' | '210' | '301' | '303' | '307' | '321' | '322' | '332' | '333';
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
export type MUCMessageEventData = {
    stanza: Element;
    attrs: MUCMessageAttributes;
    chatbox: MUC;
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
    codes: MUCStatusCode[];
};
export type MUCMessageAttributes = MessageAttributes & ExtraMUCAttributes;
export type MUCAffiliation = 'owner' | 'admin' | 'member' | 'outcast' | 'none';
export type MUCRole = 'moderator' | 'participant' | 'visitor' | 'none';
/**
 * Either the JID or the nickname (or both) will be available.
 */
export type MemberListItem = {
    affiliation: MUCAffiliation;
    role?: MUCRole;
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
export type MUCPresenceItemAttributes = {
    actor?: {
        nick?: string;
        jid?: string;
    };
    affiliation?: MUCAffiliation;
    jid?: string;
    nick: string;
    reason?: string;
    role?: MUCRole;
};
export type MUCPresenceAttributes = MUCPresenceItemAttributes & {
    codes: MUCStatusCode[];
    from: string;
    hats: Array<MUCHat>;
    image_hash?: string;
    is_self: boolean;
    muc_jid: string;
    nick: string;
    occupant_id: string;
    show: string;
    states: Array<string>;
    status?: string;
    type: string;
};
export {};
//# sourceMappingURL=types.d.ts.map