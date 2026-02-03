/**
 * Merge the second object into the first one.
 * @param {Object} dst
 * @param {Object} src
 */
export function merge(dst, src) {
    for (const k in src) {
        if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
        if (k === "__proto__" || k === "constructor") continue;

        if (dst[k] instanceof Object) {
            merge(dst[k], src[k]);
        } else {
            dst[k] = src[k];
        }
    }
}

/**
 * @param {unknown} obj - The object to check.
 * @returns {boolean} True if the object is an Error, false otherwise.
 */
export function isError(obj) {
    return Object.prototype.toString.call(obj) === "[object Error]";
}

/**
 * @param {unknown} val - The value to check.
 * @returns {boolean} True if the value is a function, false otherwise.
 */
export function isFunction(val) {
    return typeof val === "function";
}

/**
 * @param {unknown} x - The value to check.
 * @returns {boolean} True if the value is undefined, false otherwise.
 */
export function isUndefined(x) {
    return typeof x === "undefined";
}

/**
 * @param {unknown} o - The value to check.
 * @returns {boolean} True if the value is an Error
 */
export function isErrorObject(o) {
    return o instanceof Error;
}

/**
 * @param {import('@converse/skeletor').Model} model
 * @returns {import('@converse/skeletor').BrowserStorage}
 */
export function isPersistableModel(model) {
    return model.browserStorage || model.collection?.browserStorage;
}
