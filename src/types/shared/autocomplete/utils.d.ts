/**
 * @param {string} text
 * @param {string} input
 * @returns {boolean}
 */
export function FILTER_CONTAINS(text: string, input: string): boolean;
/**
 * @param {string} text
 * @param {string} input
 * @returns {boolean}
 */
export function FILTER_STARTSWITH(text: string, input: string): boolean;
export namespace helpers {
    function getElement(expr: any, el: any): any;
    function bind(element: any, o: any): void;
    function unbind(element: any, o: any): void;
    function regExpEscape(s: any): any;
    function isMention(word: any, ac_triggers: any): any;
}
export function SORT_BY_QUERY_POSITION(a: any, b: any): number;
export function ITEM(text: any, input: any): HTMLLIElement;
//# sourceMappingURL=utils.d.ts.map