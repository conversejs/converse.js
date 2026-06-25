// Parsed XEP-0115 entity capabilities, as advertised in a presence stanza's
// `<c xmlns="http://jabber.org/protocol/caps"/>` element.
export type CapsAttributes = {
    hash: string;
    node: string;
    ver: string;
};

// A service-discovery identity, as used when (re)computing a verification hash.
export type CapsIdentity = {
    category: string;
    type: string;
    name?: string;
    lang?: string;
};

// The verified disco#info data cached against a verification hash.
export type CapsInfoData = {
    identities: CapsIdentity[];
    features: string[];
    dataforms: Record<string, unknown>[];
};
