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
    static getQueryParameters(options?: {}): {};
    static parseXMLResult(set: any): {
        index: number;
    };
    /**
     * Creates a new RSM instance
     * @param { Object } options - Configuration options
     */
    constructor(options?: any);
    query: {};
    result: {};
    /**
     * Returns a `<set>` XML element that confirms to XEP-0059 Result Set Management.
     * The element is constructed based on the RSMQueryOptions
     * that are set on this RSM instance.
     * @returns {Element}
     */
    toXML(): Element;
    /**
     * Returns a string representation of the result-set XML
     * @returns {string}
     */
    toString(): string;
    /**
     * @param {string} max
     * @param {string} before
     */
    next(max: string, before: string): RSM;
    /**
     * @param {string} max
     * @param {string} after
     */
    previous(max: string, after: string): RSM;
}
declare function toString(v: any): any;
declare function toNumber(v: any): number;
export {};
//# sourceMappingURL=rsm.d.ts.map