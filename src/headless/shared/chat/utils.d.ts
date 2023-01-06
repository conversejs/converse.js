export function pruneHistory(model: any): void;
/**
 * Given an array of {@link MediaURLMetadata} objects and text, return an
 * array of {@link MediaURL} objects.
 * @param { Array<MediaURLMetadata> } arr
 * @param { String } text
 * @returns{ Array<MediaURL> }
 */
export function getMediaURLs(arr: Array<MediaURLMetadata>, text: string, offset?: number): Array<MediaURL>;
/**
 * Determines whether the given attributes of an incoming message
 * represent a XEP-0308 correction and, if so, handles it appropriately.
 * @private
 * @method _converse.ChatBox#handleCorrection
 * @param { _converse.ChatBox | _converse.ChatRoom }
 * @param { object } attrs - Attributes representing a received
 *  message, as returned by {@link parseMessage}
 * @returns { _converse.Message|undefined } Returns the corrected
 *  message or `undefined` if not applicable.
 */
export function handleCorrection(model: any, attrs: object): _converse.Message | undefined;
export const debouncedPruneHistory: any;
