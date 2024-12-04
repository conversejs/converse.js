/**
 * Parses a passed in message stanza and returns an object of attributes.
 * @param {Element} stanza - The message stanza
 * @returns {Promise<import('./types.ts').MessageAttributes|StanzaParseError>}
 */
export function parseMessage(stanza: Element): Promise<import("./types.ts").MessageAttributes | StanzaParseError>;
import { StanzaParseError } from '../../shared/parsers';
//# sourceMappingURL=parsers.d.ts.map