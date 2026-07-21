/**
 * @param {Element|Document|DocumentFragment} context
 * @param {string} selector
 * @returns {Element[]}
 */
export function selectAll(context: Element | Document | DocumentFragment, selector: string): Element[];
/**
 * @param {Element|Document|DocumentFragment} context
 * @param {string} selector
 * @returns {Element|null}
 */
export function selectFirst(context: Element | Document | DocumentFragment, selector: string): Element | null;
/**
 * @param {Element} el
 * @param {string} selector
 * @returns {boolean}
 */
export function matches(el: Element, selector: string): boolean;
//# sourceMappingURL=selector.d.ts.map