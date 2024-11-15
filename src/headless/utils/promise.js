import log from '../log.js';
import { getOpenPromise } from '@converse/openpromise';

export { getOpenPromise };

/**
 * Clears the specified timeout and interval.
 * @method u#clearTimers
 * @param {ReturnType<typeof setTimeout>} timeout - Id if the timeout to clear.
 * @param {ReturnType<typeof setInterval>} interval - Id of the interval to clear.
 * @copyright Simen Bekkhus 2016
 * @license MIT
 */
function clearTimers(timeout, interval) {
    clearTimeout(timeout);
    clearInterval(interval);
}

/**
 * Creates a {@link Promise} that resolves if the passed in function returns a truthy value.
 * Rejects if it throws or does not return truthy within the given max_wait.
 * @param { Function } func - The function called every check_delay,
 *  and the result of which is the resolved value of the promise.
 * @param { number } [max_wait=300] - The time to wait before rejecting the promise.
 * @param { number } [check_delay=3] - The time to wait before each invocation of {func}.
 * @returns {Promise} A promise resolved with the value of func,
 *  or rejected with the exception thrown by it or it times out.
 * @copyright Simen Bekkhus 2016
 * @license MIT
 */
export function waitUntil (func, max_wait=300, check_delay=3) {
    // Run the function once without setting up any listeners in case it's already true
    try {
        const result = func();
        if (result) {
            return Promise.resolve(result);
        }
    } catch (e) {
        return Promise.reject(e);
    }

    const promise = getOpenPromise();
    const timeout_err = new Error();

    function checker () {
        try {
            const result = func();
            if (result) {
                clearTimers(max_wait_timeout, interval);
                promise.resolve(result);
            }
        } catch (e) {
            clearTimers(max_wait_timeout, interval);
            promise.reject(e);
        }
    }

    const interval = setInterval(checker, check_delay);

    function handler () {
        clearTimers(max_wait_timeout, interval);
        const err_msg = `Wait until promise timed out: \n\n${timeout_err.stack}`;
        console.trace();
        log.error(err_msg);
        promise.reject(new Error(err_msg));
    }

    const max_wait_timeout = setTimeout(handler, max_wait);

    return promise;
}
