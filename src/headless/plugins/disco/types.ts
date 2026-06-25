export type DiscoInfoOptions = {
    timeout?: number;
    node?: string; // A node to scope the disco#info query to (e.g. an XEP-0115 caps "node#ver")
}

export type FetchEntityFeaturesOptions = {
    timeout?: number;
    ignore_cache?: boolean;
    node?: string; // A node to scope the disco#info query to (e.g. an XEP-0115 caps "node#ver")
}

// A service-discovery identity (XEP-0030).
export type DiscoIdentity = {
    category: string;
    type: string;
    name?: string;
    lang?: string;
};

// The salient parts of a disco#info result: identities, features and (XEP-0128)
// data forms. Used to restore an entity's features from a cache without querying.
export type DiscoInfoData = {
    identities: DiscoIdentity[];
    features: string[];
    dataforms: Record<string, string[]>[];
};

// What a `discoEntityInfoRequested` hook listener may return so that disco can
// skip (or scope) its disco#info query:
//  - `info`: cached disco#info to populate the entity from instead of querying;
//  - `node`: a node to scope the query to on a cache miss.
// disco treats both as opaque — it never interprets where they came from.
export type DiscoInfoLookup = {
    info: DiscoInfoData | null;
    node: string | null;
};
