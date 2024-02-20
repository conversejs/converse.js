/**
 * Custom error for indicating timeouts
 * @namespace converse.env
 */
export class TimeoutError extends Error {
    /**
     * @param  {string} message
     */
    constructor(message: string);
    retry_event_id: any;
}
//# sourceMappingURL=errors.d.ts.map