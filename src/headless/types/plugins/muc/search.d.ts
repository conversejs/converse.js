export function clearSearchState(): void;
/**
 * Records XEP-0433's application-specific error conditions on parsed errors.
 * @param {Element} stanza
 * @param {import('../../shared/types').ErrorExtra} extra
 */
export function parseChannelSearchError(stanza: Element, extra: import("../../shared/types").ErrorExtra): import("../../shared/types").ErrorExtra;
/**
 * Thrown instead of searching when we know a search service won't answer:
 * its `code` says why, and `retry_after` from when it may answer again.
 */
export class ChannelSearchRefusedError extends CodedError {
    /**
     * @param {import('./types').ChannelSearchRefusal} code
     * @param {string} service
     * @param {Date} [retry_after]
     */
    constructor(code: import("./types").ChannelSearchRefusal, service: string, retry_after?: Date);
    service: string;
    retry_after: Date;
}
declare namespace _default {
    /**
     * Searches for public groupchats across servers, using a XEP-0433
     * Extended Channel Search service such as search.jabber.network.
     *
     * Falls back to the pre-standard protocol of that service when the
     * service doesn't speak XEP-0433.
     *
     * @method api.rooms.search
     * @param {string} query - Keywords to look for in the names, descriptions and addresses of groupchats
     * @param {import('./types').ChannelSearchOptions} [options]
     * @returns {Promise<import('./types').ChannelSearchResult>}
     * @throws {ChannelSearchRefusedError} Without querying, when the search service
     *  rate-limited us or didn't respond recently, or supports neither protocol.
     * @throws {Error} When no search service is configured, or the search service
     *  returns an error.
     *
     * @example
     * const { items, last } = await api.rooms.search('xmpp');
     * // Fetch the next page
     * const next = await api.rooms.search('xmpp', { after: last });
     */
    function search(query: string, options?: import("./types").ChannelSearchOptions): Promise<import("./types").ChannelSearchResult>;
}
export default _default;
import { CodedError } from '../../shared/errors.js';
//# sourceMappingURL=search.d.ts.map