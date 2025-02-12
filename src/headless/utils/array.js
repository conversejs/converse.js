/**
 * @template {any} T
 * @param {Array<T>} arr
 * @returns {Array<T>} A new array containing only unique elements from the input array.
 */
export function unique (arr) {
    return [...new Set(arr)];
}
