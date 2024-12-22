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
     * @param {Element} stanza
     * @param {string} [message]
     */
    constructor(stanza: Element, message?: string);
    stanza: Element;
}
export class StanzaParseError extends StanzaError {
}
export class NotImplementedError extends StanzaError {
}
export class ForbiddenError extends StanzaError {
}
export class BadRequestError extends StanzaError {
}
export class NotAllowedError extends StanzaError {
}
export class ItemNotFoundError extends StanzaError {
}
export class NotAcceptableError extends StanzaError {
}
//# sourceMappingURL=errors.d.ts.map