/**
 * Waiting on a promise for a limited time.
 * @module @converse/daemon/timeout
 */

/** What {@link withTimeout} resolves with when the promise is too slow. */
export const TIMED_OUT = Symbol('timed out');

/**
 * Resolves with the promise's value, or with TIMED_OUT if it takes longer than `ms`.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T|typeof TIMED_OUT>}
 */
export function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
