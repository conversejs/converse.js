export class MethodNotImplementedError extends Error {
}
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
    constructor(name: import("./types").ErrorName | "unknown", e: Element, extra: any);
    /** @type {ErrorType} */
    type: import("./types").ErrorType;
    /** @type {Element} */
    el: Element;
    /** @type {ErrorExtra} */
    extra: import("./types").ErrorExtra;
}
export class StanzaParseError extends Error {
    /**
     * @param {Element} stanza
     * @param {string} [message]
     */
    constructor(stanza: Element, message?: string);
    stanza: Element;
}
export class BadRequestError extends StanzaError {
}
export class ConflictError extends StanzaError {
}
export class FeatureNotImplementedError extends StanzaError {
}
export class ForbiddenError extends StanzaError {
}
export class GoneError extends StanzaError {
}
export class InternalServerError extends StanzaError {
}
export class ItemNotFoundError extends StanzaError {
}
export class JIDMalformedError extends StanzaError {
}
export class NotAcceptableError extends StanzaError {
}
export class NotAllowedError extends StanzaError {
}
export class NotAuthorizedError extends StanzaError {
}
export class PaymentRequiredError extends StanzaError {
}
export class RecipientUnavailableError extends StanzaError {
}
export class RedirectError extends StanzaError {
}
export class RegistrationRequiredError extends StanzaError {
}
export class RemoteServerNotFoundError extends StanzaError {
}
export class RemoteServerTimeoutError extends StanzaError {
}
export class ResourceConstraintError extends StanzaError {
}
export class ServiceUnavailableError extends StanzaError {
}
export class SubscriptionRequiredError extends StanzaError {
}
export class UndefinedConditionError extends StanzaError {
}
export class UnexpectedRequestError extends StanzaError {
}
//# sourceMappingURL=errors.d.ts.map