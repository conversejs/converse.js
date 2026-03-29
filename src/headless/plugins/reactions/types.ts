import { MUCMessageAttributes } from '../../plugins/muc/types';
import { MessageAttributes } from '../../shared/types';

export type ReactionsMap = Record<string, string[]>;

export type ReactionsAttributes = {
    reactions?: ReactionsMap;
    reaction_to_id?: string;
    dangling_reaction?: boolean;
};

export type MUCMessageAttrsWithReactions = MUCMessageAttributes & ReactionsAttributes;
export type MessageAttrsWithReactions = MessageAttributes & ReactionsAttributes;
