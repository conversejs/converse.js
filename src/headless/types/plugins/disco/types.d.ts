export type DiscoInfoOptions = {
    timeout?: number;
    node?: string;
};
export type FetchEntityFeaturesOptions = {
    timeout?: number;
    ignore_cache?: boolean;
    node?: string;
};
export type DiscoIdentity = {
    category: string;
    type: string;
    name?: string;
    lang?: string;
};
export type DiscoInfoData = {
    identities: DiscoIdentity[];
    features: string[];
    dataforms: Record<string, string[]>[];
};
export type DiscoInfoLookup = {
    info: DiscoInfoData | null;
    node: string | null;
};
//# sourceMappingURL=types.d.ts.map