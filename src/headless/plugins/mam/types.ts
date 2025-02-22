import { RSM } from '../../shared/rsm';

export type MAMQueryOptions = {
    end?: string; // A date string in ISO-8601 format, before which messages should be returned.
    start?: string; // A date string in ISO-8601 format, after which messages should be returned.
    with?: string; // A JID against which to match messages, according to either the `to` or `from` attribute.
    // An item in a MUC archive matches if the publisher of the item matches the JID.
    // If `with` is omitted, all messages that match the rest of the query will be returned, regardless of to/from
    // addresses of each message.
};

// XEP-0059 RSM Attributes that can be used to filter query results
// Specifying both "after" and "before" is undefined behavior.
type RSMQueryOptions = {
    after?: string; // The XEP-0359 stanza ID of a message after which messages should be returned. Implies forward paging.
    before?: string; // The XEP-0359 stanza ID of a message before which messages should be returned. Implies backward paging.
    index?: number; // The index of the results page to return.
    max?: number; // The maximum number of items to return.
};

export type FetchArchivedMessagesOptions = {
    mam?: MAMQueryOptions;
    rsm?: RSMQueryOptions
};

// The options that can be passed in to the api.archive.query method
export type ArchiveQueryOptions = FetchArchivedMessagesOptions & {
    is_groupchat?: boolean; // Whether the MAM archive is for a groupchat.
};

export type MAMQueryResult = {
    messages: any[];
    rsm?: RSM; // You can call `next()` or `previous()` on this,
    // to get the RSM query parameters for the next or previous page in the result set.
    complete?: boolean;
    error?: Error;
};
