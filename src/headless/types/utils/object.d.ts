/**
 * Merge the second object into the first one.
 * @param {Object} dst
 * @param {Object} src
 */
export function merge(dst: any, src: any): void;
/**
 * @param {unknown} obj - The object to check.
 * @returns {boolean} True if the object is an Error, false otherwise.
 */
export function isError(obj: unknown): boolean;
/**
 * @param {unknown} val - The value to check.
 * @returns {boolean} True if the value is a function, false otherwise.
 */
export function isFunction(val: unknown): boolean;
/**
 * @param {unknown} x - The value to check.
 * @returns {boolean} True if the value is undefined, false otherwise.
 */
export function isUndefined(x: unknown): boolean;
/**
 * @param {unknown} o - The value to check.
 * @returns {boolean} True if the value is an Error
 */
export function isErrorObject(o: unknown): boolean;
/**
 * @param {import('@converse/skeletor').Model} model
 * @returns {import('@converse/skeletor').BrowserStorage}
 */
export function isPersistableModel(model: import("@converse/skeletor").Model): import("@converse/skeletor").BrowserStorage;
/**
 * Check if an object is empty (null, undefined, not an object, or has no own keys).
 * @param {Object|undefined|null} obj
 * @returns {boolean} True if the object is empty.
 */
export function isEmpty(obj: any | undefined | null): boolean;
//# sourceMappingURL=object.d.ts.map