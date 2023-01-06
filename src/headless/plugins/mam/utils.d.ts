import type ChatBox from '../chat/model.d';
import type ChatRoomMixin from '../muc/muc.d';


export function onMAMError(iq: any): void;
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
 */
export function onMAMPreferences(iq: any, feature: any): void;
export function getMAMPrefsFromFeature(feature: any): void;
export function preMUCJoinMAMFetch(muc: any): void;
export function handleMAMResult(model: any, result: any, query: any, options: any, should_page: any): Promise<void>;
/**
 * @typedef { Object } MAMOptions
 * A map of MAM related options that may be passed to fetchArchivedMessages
 * @param { number } [options.max] - The maximum number of items to return.
 *  Defaults to "archived_messages_page_size"
 * @param { string } [options.after] - The XEP-0359 stanza ID of a message
 *  after which messages should be returned. Implies forward paging.
 * @param { string } [options.before] - The XEP-0359 stanza ID of a message
 *  before which messages should be returned. Implies backward paging.
 * @param { string } [options.end] - A date string in ISO-8601 format,
 *  before which messages should be returned. Implies backward paging.
 * @param { string } [options.start] - A date string in ISO-8601 format,
 *  after which messages should be returned. Implies forward paging.
 * @param { string } [options.with] - The JID of the entity with
 *  which messages were exchanged.
 * @param { boolean } [options.groupchat] - True if archive in groupchat.
 */
/**
 * Fetch XEP-0313 archived messages based on the passed in criteria.
 * @param { ChatBox | ChatRoom } model
 * @param { MAMOptions } [options]
 * @param { ('forwards'|'backwards'|null)} [should_page=null] - Determines whether
 *  this function should recursively page through the entire result set if a limited
 *  number of results were returned.
 */
export function fetchArchivedMessages(model: ChatBox | ChatRoomMixin, options?: MAMOptions, should_page?: ('forwards' | 'backwards' | null)): any;
/**
 * Fetches messages that might have been archived *after*
 * the last archived message in our local cache.
 * @param { _converse.ChatBox | _converse.ChatRoom }
 */
export function fetchNewestMessages(model: any): void;
/**
 * A map of MAM related options that may be passed to fetchArchivedMessages
 */
export type MAMOptions = any;
