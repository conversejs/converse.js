import { MessageAttributes } from '../chat/types';

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
