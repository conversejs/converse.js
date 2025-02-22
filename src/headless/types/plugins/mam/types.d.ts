import { RSM } from '../../shared/rsm';
export type MAMQueryOptions = {
    end?: string;
    start?: string;
    with?: string;
};
type RSMQueryOptions = {
    after?: string;
    before?: string;
    index?: number;
    max?: number;
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
export {};
//# sourceMappingURL=types.d.ts.map