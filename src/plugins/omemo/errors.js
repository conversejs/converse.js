export class IQError extends Error {
    constructor (message, iq) {
        super(message);
        this.name = 'IQError';
        this.iq = iq;
    }
}
