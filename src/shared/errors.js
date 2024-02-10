export class IQError extends Error {
    /**
     * @param {string} message
     * @param {Element} iq
     */
    constructor (message, iq) {
        super(message);
        this.name = 'IQError';
        this.iq = iq;
    }
}

export class UserFacingError extends Error {

    /**
     * @param {string} message
     */
    constructor (message) {
        super(message);
        this.name = 'UserFacingError';
        this.user_facing = true;
    }
}
