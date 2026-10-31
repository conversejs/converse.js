/**
 * @param {Element|Error} e
 * @param {Element} iq
 */
export function onMAMError(e: Element | Error, iq: Element): Promise<void>;
/**
 * Handle returned IQ stanza containing Message Archive
 * Management (XEP-0313) preferences.
 *
 * XXX: For now we only handle the global default preference.
 * The XEP also provides for per-JID preferences, which is
 * currently not supported in converse.js.
 *
 * Per JID preferences will be set in chat boxes, so it'll
 * probably be handled elsewhere in any case.
 *
 * @param {Element} iq
 * @param {Model} feature
 */
export function onMAMPreferences(iq: Element, feature: Model): void;
/**
 * @param {Model} feature
 */
export function getMAMPrefsFromFeature(feature: Model): void;
/**
 * @param {MUC} muc
 */
export function preMUCJoinMAMFetch(muc: MUC): void;
/**
 * @param {ChatBox|MUC} model
 * @param {Object} result
 * @param {Object} query
 * @param {Object} options
 * @param {('forwards'|'backwards'|false)} [should_page=false]
 */
export function handleMAMResult(model: ChatBox | MUC, result: any, query: any, options: any, should_page?: ("forwards" | "backwards" | false)): Promise<void>;
/**
 * Fetch XEP-0313 archived messages based on the passed in criteria.
 * @param {ChatBox|MUC} model
 * @param {import('./types').FetchArchivedMessagesOptions} [options]
 * @param {('forwards'|'backwards'|false)} [should_page=false] - Determines whether
 *  this function should recursively page through the entire result set if a limited
 *  number of results were returned.
 * @returns {Promise<import('./types').MAMQueryResult|undefined>} The archive's
 *  answer, which has an `error` if the query failed. Undefined if no query was made.
 */
export function fetchArchivedMessages(model: ChatBox | MUC, options?: import("./types").FetchArchivedMessagesOptions, should_page?: ("forwards" | "backwards" | false)): Promise<import("./types").MAMQueryResult | undefined>;
/**
 * Creates a placeholder to fetch messages at the top of the chat history.
 * @param {ChatBox|MUC} model
 */
export function createScrollupPlaceholder(model: ChatBox | MUC): void;
/**
 * Fetches messages that might have been archived *after*
 * the last archived message in our local cache.
 * @param {ChatBox|MUC} model
 */
export function fetchNewestMessages(model: ChatBox | MUC): Promise<import("./types").MAMQueryResult>;
/**
 * Searches the archive for messages whose text matches `text` (XEP-0431), and
 * holds the ones found in their conversations, so that they're messages like
 * any other: they can be read, replied to and reacted to.
 *
 * A room's archive is searched only if we're in the room, since a message from
 * one we aren't in has no conversation to be held in.
 * @param {string} text
 * @param {Object} [options]
 * @param {string} [options.with] - The bare JID of a contact or room, to search only that conversation
 * @param {number} [options.max] - The most matches to return, the newest
 * @returns {Promise<{messages: import('../../shared/message.js').default[], complete: boolean}|null>}
 *  The matches, oldest first, or null if the server can't search its archive. Throws if the query fails.
 */
export function searchArchive(text: string, { with: jid, max }?: {
    with?: string;
    max?: number;
}): Promise<{
    messages: import("../../shared/message.js").default[];
    complete: boolean;
} | null>;
export type MUC = import("../muc/muc").default;
export type ChatBox = import("../chat/model").default;
export type Model = import("@converse/skeletor").Model;
//# sourceMappingURL=utils.d.ts.map