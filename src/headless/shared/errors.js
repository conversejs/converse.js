export class MethodNotImplementedError extends Error {}

/**
 * Custom error for indicating timeouts
 * @namespace converse.env
 */
export class TimeoutError extends Error {
    /**
     * @param  {string} message
     */
    constructor(message) {
        super(message);
        this.retry_event_id = null;
    }
}

export class StanzaError extends Error {
    /**
     * @param {Element} stanza
     * @param {string} [message]
     */
    constructor(stanza, message) {
        super(message);
        this.name = stanza.nodeName;
        this.stanza = stanza;
    }
}

export class StanzaParseError extends StanzaError {
    /**
     * @param {Element} stanza
     * @param {string} [message]
     */
    constructor(stanza, message) {
        super(stanza, message);
        this.name = 'StanzaParseError';
    }
}

export class NotImplementedError extends StanzaError {}
export class ForbiddenError extends StanzaError {}
export class BadRequestError extends StanzaError {}
export class NotAllowedError extends StanzaError {}
export class ItemNotFoundError extends StanzaError {}
