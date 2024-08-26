/**
 * Custom error for indicating timeouts
 * @namespace converse.env
 */
export class TimeoutError extends Error {

    /**
     * @param  {string} message
     */
    constructor (message) {
        super(message);
        this.retry_event_id = null;
    }
}

export class NotImplementedError extends Error {}
