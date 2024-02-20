export namespace RSM_TYPES {
    export { toString as after };
    export { toString as before };
    export { toNumber as count };
    export { toString as first };
    export { toNumber as index };
    export { toString as last };
    export { toNumber as max };
}
export const RSM_ATTRIBUTES: string[];
/**
 * Instances of this class are used to page through query results according to XEP-0059 Result Set Management
 * @class RSM
 */
export class RSM {
    static getQueryParameters(options?: {}): any;
    static parseXMLResult(set: any): {
        index: number;
    };
    /**
     * Create a new RSM instance
     * @param { Object } options - Configuration options
     * @constructor
     */
    constructor(options?: any);
    query: any;
    result: {};
    /**
     * Returns a `<set>` XML element that confirms to XEP-0059 Result Set Management.
     * The element is constructed based on the {@link module:converse-rsm~RSMQueryParameters}
     * that are set on this RSM instance.
     * @returns { Element }
     */
    toXML(): Element;
    next(max: any, before: any): RSM;
    previous(max: any, after: any): RSM;
}
/**
 * [XEP-0059 RSM](https://xmpp.org/extensions/xep-0059.html) Attributes that can be used to filter query results
 */
export type RSMQueryParameters = {
    /**
     * - The XEP-0359 stanza ID of a message after which messages should be returned. Implies forward paging.
     */
    after?: string;
    /**
     * - The XEP-0359 stanza ID of a message before which messages should be returned. Implies backward paging.
     */
    before?: string;
    /**
     * - The index of the results page to return.
     */
    index?: number;
    /**
     * - The maximum number of items to return.
     */
    max?: number;
};
declare function toString(v: any): any;
declare function toNumber(v: any): number;
export {};
//# sourceMappingURL=rsm.d.ts.map