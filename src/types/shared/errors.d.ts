export class IQError extends Error {
    /**
     * @param {string} message
     * @param {Element} iq
     */
    constructor(message: string, iq: Element);
    iq: Element;
}
export class UserFacingError extends Error {
    /**
     * @param {string} message
     */
    constructor(message: string);
    user_facing: boolean;
}
//# sourceMappingURL=errors.d.ts.map