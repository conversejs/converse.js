import { RSM } from '../../shared/rsm';
export type MAMOptions = {
    max?: number;
    after?: string;
    before?: string;
    end?: string;
    start?: string;
    with?: string;
    groupchat?: boolean;
};
type RSMQueryParameters = {
    after?: string;
    before?: string;
    index?: number;
    max?: number;
};
export type MAMFilterParameters = RSMQueryParameters & {
    end?: string;
    start?: string;
    with?: string;
};
export type ArchiveQueryOptions = MAMFilterParameters & {
    groupchat?: boolean;
};
export type MAMQueryResult = {
    messages: any[];
    rsm?: RSM;
    complete?: boolean;
    error?: Error;
};
export {};
//# sourceMappingURL=types.d.ts.map