/**
 * Merge the second object into the first one.
 * @param {Object} dst
 * @param {Object} src
 */
export function merge (dst, src) {
    for (const k in src) {
        if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
        if (k === '__proto__' || k === 'constructor') continue;

        if (dst[k] instanceof Object) {
            merge(dst[k], src[k]);
        } else {
            dst[k] = src[k];
        }
    }
}
