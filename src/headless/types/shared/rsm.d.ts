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
    static getQueryParameters(options?: {}): Partial<{}>;
    static parseXMLResult(set: any): {
        index: number;
    };
    /**
     * Create a new RSM instance
     * @param { Object } options - Configuration options
     * @constructor
     */
    constructor(options?: any);
    query: Partial<{}>;
    result: {};
    /**
     * Returns a `<set>` XML element that confirms to XEP-0059 Result Set Management.
     * The element is constructed based on the RSMQueryOptions
     * that are set on this RSM instance.
     * @returns {Element}
     */
    toXML(): Element;
    next(max: any, before: any): RSM;
    previous(max: any, after: any): RSM;
}
declare function toString(v: any): any;
declare function toNumber(v: any): number;
export {};
//# sourceMappingURL=rsm.d.ts.map