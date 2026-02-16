import { MUCMessageAttributes } from '../../plugins/muc/types';
import { MessageAttributes } from '../../shared/types';

export type ReactionsAttributes = {
    reactions?: Record<string, string[]>;
};

export type MUCMessageAttrsWithReactions = MUCMessageAttributes & ReactionsAttributes;
export type MessageAttrsWithReactions = MessageAttributes & ReactionsAttributes;
