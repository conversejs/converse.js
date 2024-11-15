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
export function waitUntil(func: Function, max_wait?: number, check_delay?: number): Promise<any>;
export { getOpenPromise };
//# sourceMappingURL=promise.d.ts.map