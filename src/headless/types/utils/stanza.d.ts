/**
 * @param {Element} stanza
 * @returns {boolean}
 */
export function isErrorStanza(stanza: Element): boolean;
/**
 * @param {Element} stanza
 * @returns {boolean}
 */
export function isForbiddenError(stanza: Element): boolean;
/**
 * @param {Element} stanza
 * @returns {boolean}
 */
export function isServiceUnavailableError(stanza: Element): boolean;
/**
 * Returns an object containing all attribute names and values for a particular element.
 * @param {Element} stanza
 * @returns {object}
 */
export function getAttributes(stanza: Element): object;
export { toStanza };
import { toStanza } from 'strophe.js';
//# sourceMappingURL=stanza.d.ts.map