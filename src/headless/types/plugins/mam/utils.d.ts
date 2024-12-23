/**
 * @param {Element} iq
 */
export function onMAMError(iq: Element): Promise<void>;
/**
 * Handle returned IQ stanza containing Message Archive
 * Management (XEP-0313) preferences.
 *
 * XXX: For now we only handle the global default preference.
 * The XEP also provides for per-JID preferences, which is
 * currently not supported in converse.js.
 *
 * Per JID preferences will be set in chat boxes, so it'll
 * probbaly be handled elsewhere in any case.
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
 * @param {('forwards'|'backwards'|null)} [should_page=null]
 */
export function handleMAMResult(model: ChatBox | MUC, result: any, query: any, options: any, should_page?: ("forwards" | "backwards" | null)): Promise<void>;
/**
 * Fetch XEP-0313 archived messages based on the passed in criteria.
 * @param {ChatBox|MUC} model
 * @param {import('./types').MAMOptions} [options]
 * @param {('forwards'|'backwards'|null)} [should_page=null] - Determines whether
 *  this function should recursively page through the entire result set if a limited
 *  number of results were returned.
 */
export function fetchArchivedMessages(model: ChatBox | MUC, options?: import("./types").MAMOptions, should_page?: ("forwards" | "backwards" | null)): Promise<void>;
/**
 * Fetches messages that might have been archived *after*
 * the last archived message in our local cache.
 * @param {ChatBox|MUC} model
 */
export function fetchNewestMessages(model: ChatBox | MUC): void;
export type MUC = import("../muc/muc.js").default;
export type ChatBox = import("../chat/model.js").default;
export type Model = import("@converse/skeletor/src/types/helpers.js").Model;
//# sourceMappingURL=utils.d.ts.map