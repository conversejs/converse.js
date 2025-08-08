export class MethodNotImplementedError extends Error {}

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
     * @typedef {import("./types").ErrorName} ErrorName
     * @typedef {import("./types").ErrorType} ErrorType
     * @typedef {import("./types").ErrorExtra} ErrorExtra
     */

    /**
     * @param {ErrorName|'unknown'} name
     * @param {Element} e - The <error> element from a stanza
     * @param {Object} extra - Extra properties from plugin parsers
     */
    constructor(name, e, extra) {
        super(e.querySelector('text')?.textContent ?? '');
        /** @type {ErrorName} */
        this.name = name
        /** @type {string} */
        this.message = name;
        /** @type {ErrorType} */
        this.type = /** @type {ErrorType} */ (e.getAttribute('type'));
        /** @type {Element} */
        this.el = e;
        /** @type {ErrorExtra} */
        this.extra = extra;
    }
}

export class StanzaParseError extends Error {
    /**
     * @param {Element} stanza
     * @param {string} [message]
     */
    constructor(stanza, message) {
        super(message);
        this.name = 'StanzaParseError';
        this.stanza = stanza;
    }
}

export class BadRequestError extends StanzaError {}
export class ConflictError extends StanzaError {}
export class FeatureNotImplementedError extends StanzaError {}
export class ForbiddenError extends StanzaError {}
export class GoneError extends StanzaError {}
export class InternalServerError extends StanzaError {}
export class ItemNotFoundError extends StanzaError {}
export class JIDMalformedError extends StanzaError {}
export class NotAcceptableError extends StanzaError {}
export class NotAllowedError extends StanzaError {}
export class NotAuthorizedError extends StanzaError {}
export class PaymentRequiredError extends StanzaError {}
export class RecipientUnavailableError extends StanzaError {}
export class RedirectError extends StanzaError {}
export class RegistrationRequiredError extends StanzaError {}
export class RemoteServerNotFoundError extends StanzaError {}
export class RemoteServerTimeoutError extends StanzaError {}
export class ResourceConstraintError extends StanzaError {}
export class ServiceUnavailableError extends StanzaError {}
export class SubscriptionRequiredError extends StanzaError {}
export class UndefinedConditionError extends StanzaError {}
export class UnexpectedRequestError extends StanzaError {}
