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
export {};
//# sourceMappingURL=types.d.ts.map