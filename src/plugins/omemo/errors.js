export class IQError extends Error {
    constructor (message, iq) {
        super(message, iq);
        this.name = 'IQError';
        this.iq = iq;
    }
}
