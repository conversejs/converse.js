import { CHAT_STATES } from '../../shared/constants';
import { MessageAttributes } from '../chat/types';

export type DefaultMUCAttributes = {
    bookmarked: boolean;
    chat_state: typeof CHAT_STATES;
    has_activity: boolean; // XEP-437
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
    activities: Array<Object>; // A list of objects representing XEP-0316 MEP notification data
    from_muc: string; // The JID of the MUC from which this message was sent
    from_real_jid: string; // The real JID of the sender, if available
    moderated: string; // The type of XEP-0425 moderation (if any) that was applied
    moderated_by: string; // The JID of the user that moderated this message
    moderated_id: string; // The  XEP-0359 Stanza ID of the message that this one moderates
    moderation_reason: string; // The reason provided why this message moderates another
    occupant_id: string; // The XEP-0421 occupant ID
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
    hats: Array<MUCHat>; // An array of XEP-0317 hats
    states: Array<string>;
    from: string; // The sender JID (${muc_jid}/${nick})
    nick: string; // The nickname of the sender
    occupant_id: string; // The XEP-0421 occupant ID
    type: string; // The type of presence
    jid?: string;
    is_me?: boolean;
};
