import { RSMQueryOptions } from 'shared/types';
import { RSM } from '../../shared/rsm';
export type MAMQueryOptions = {
    end?: string;
    start?: string;
    with?: string;
};
export type FetchArchivedMessagesOptions = {
    mam?: MAMQueryOptions;
    rsm?: RSMQueryOptions;
};
export type ArchiveQueryOptions = FetchArchivedMessagesOptions & {
    is_groupchat?: boolean;
};
export type MAMQueryResult = {
    messages: any[];
    rsm?: RSM;
    complete?: boolean;
    error?: Error;
};
//# sourceMappingURL=types.d.ts.map