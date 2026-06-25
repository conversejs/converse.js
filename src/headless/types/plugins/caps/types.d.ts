export type CapsAttributes = {
    hash: string;
    node: string;
    ver: string;
};
export type CapsIdentity = {
    category: string;
    type: string;
    name?: string;
    lang?: string;
};
export type CapsInfoData = {
    identities: CapsIdentity[];
    features: string[];
    dataforms: Record<string, unknown>[];
};
//# sourceMappingURL=types.d.ts.map