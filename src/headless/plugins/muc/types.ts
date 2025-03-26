import { CHAT_STATES } from '../../shared/constants';
import { MessageAttributes } from '../../shared/types';
import MUC from './muc';

export type MUCStatusCode =
    | '100'
    | '101'
    | '102'
    | '103'
    | '104'
    | '110'
    | '170'
    | '171'
    | '172'
    | '173'
    | '174'
    | '201'
    | '210'
    | '301'
    | '303'
    | '307'
    | '321'
    | '322'
    | '332'
    | '333';

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

// An object containing the parsed {@link MUCMessageAttributes} and current {@link MUC}.
export type MUCMessageEventData = {
    stanza: Element;
    attrs: MUCMessageAttributes;
    chatbox: MUC;
}

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
    codes: MUCStatusCode[];
};

export type MUCMessageAttributes = MessageAttributes & ExtraMUCAttributes;

export type MUCAffiliation = 'owner'|'admin'|'member'|'outcast'|'none';
export type MUCRole = 'moderator'|'participant'|'visitor'|'none';

export type NonOutcastAffiliation = 'admin' | 'owner' | 'member';

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
    real_jid?: string;
    nick: string;
    reason?: string;
    role?: MUCRole;
}

export type MUCPresenceAttributes = MUCPresenceItemAttributes & {
    codes: MUCStatusCode[];
    from: string; // The sender JID (${muc_jid}/${nick})
    hats: Array<MUCHat>; // An array of XEP-0317 hats
    image_hash?: string;
    is_self: boolean;
    jid: string;
    muc_jid: string; // The JID of the MUC in which the presence was received
    nick: string; // The nickname of the sender
    occupant_id: string; // The XEP-0421 occupant ID
    show: string;
    states: Array<string>;
    status?: string;
    type: string; // The type of presence
};


export type OccupantSearchData = {
    nick?: string;
    occupant_id?: string; // The XEP-0421 unique occupant id
    real_jid?: string;
};
