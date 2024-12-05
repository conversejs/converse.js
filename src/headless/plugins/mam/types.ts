import { RSM } from '../../shared/rsm';

export type MAMOptions = {
    max?: number; // The maximum number of items to return. Defaults to "archived_messages_page_size"
    after?: string; // The XEP-0359 stanza ID of a message after which messages should be returned. Implies forward paging.
    before?: string; // The XEP-0359 stanza ID of a message before which messages should be returned. Implies backward paging.
    end?: string; // A date string in ISO-8601 format, before which messages should be returned. Implies backward paging.
    start?: string; // A date string in ISO-8601 format, after which messages should be returned. Implies forward paging.
    with?: string; // The JID of the entity with which messages were exchanged.
    groupchat?: boolean; // True if archive in groupchat.
};

// XEP-0059 RSM Attributes that can be used to filter query results
type RSMQueryParameters = {
    after?: string; // The XEP-0359 stanza ID of a message after which messages should be returned. Implies forward paging.
    before?: string; // The XEP-0359 stanza ID of a message before which messages should be returned. Implies backward paging.
    index?: number; // The index of the results page to return.
    max?: number; // The maximum number of items to return.
};

// Filter parmeters which can be used to filter a MAM XEP-0313 archive
export type MAMFilterParameters = RSMQueryParameters & {
    end?: string; // A date string in ISO-8601 format, before which messages should be returned. Implies backward paging.
    start?: string; // A date string in ISO-8601 format, after which messages should be returned. Implies forward paging.
    with?: string; // A JID against which to match messages, according to either their `to` or `from` attributes.
    // An item in a MUC archive matches if the publisher of the item matches the JID.
    // If `with` is omitted, all messages that match the rest of the query will be returned, regardless of to/from
    // addresses of each message.
};

// The options that can be passed in to the api.archive.query method
export type ArchiveQueryOptions = MAMFilterParameters & {
    groupchat?: boolean; // Whether the MAM archive is for a groupchat.
};

export type MAMQueryResult = {
    messages: any[];
    rsm?: RSM; // You can call `next()` or `previous()` on this,
    // to get the RSM query parameters for the next or previous page in the result set.
    complete?: boolean;
    error?: Error;
};
