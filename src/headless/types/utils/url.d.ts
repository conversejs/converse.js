/**
 * Will return false if URL is malformed or contains disallowed characters
 * @param {string} text
 * @returns {boolean}
 */
export function isValidURL(text: string): boolean;
/**
 * @param {string|URI} url
 */
export function getURI(url: string | URI): any;
/**
 * Given the an array of file extensions, check whether a URL points to a file
 * ending in one of them.
 * @param {string[]} types - An array of file extensions
 * @param {string} url
 * @returns {boolean}
 * @example
 *  checkFileTypes(['.gif'], 'https://conversejs.org/cat.gif?foo=bar');
 */
export function checkFileTypes(types: string[], url: string): boolean;
export function isURLWithImageExtension(url: any): boolean;
export function isGIFURL(url: any): boolean;
export function isAudioURL(url: any): boolean;
export function isVideoURL(url: any): boolean;
export function isImageURL(url: any): any;
export function isEncryptedFileURL(url: any): any;
/**
 * @typedef {Object} MediaURLMetadata
 * An object representing the metadata of a URL found in a chat message
 * The actual URL is not saved, it can be extracted via the `start` and `end` indexes.
 * @property {boolean} [is_audio]
 * @property {boolean} [is_image]
 * @property {boolean} [is_video]
 * @property {boolean} [is_encrypted]
 * @property {number} [end]
 * @property {number} [start]
 */
/**
 * An object representing a URL found in a chat message
 * @typedef {MediaURLMetadata} MediaURLData
 * @property {string} url
 */
/**
 * @param {string} text
 * @param {number} offset
 * @returns {{media_urls?: MediaURLMetadata[]}}
 */
export function getMediaURLsMetadata(text: string, offset?: number): {
    media_urls?: MediaURLMetadata[];
};
/**
 * Given an array of {@link MediaURLMetadata} objects and text, return an
 * array of {@link MediaURL} objects.
 * @param {Array<MediaURLMetadata>} arr
 * @param {string} text
 * @returns {MediaURLData[]}
 */
export function getMediaURLs(arr: Array<MediaURLMetadata>, text: string, offset?: number): MediaURLData[];
/**
 * An object representing the metadata of a URL found in a chat message
 * The actual URL is not saved, it can be extracted via the `start` and `end` indexes.
 */
export type MediaURLMetadata = {
    is_audio?: boolean;
    is_image?: boolean;
    is_video?: boolean;
    is_encrypted?: boolean;
    end?: number;
    start?: number;
};
/**
 * An object representing a URL found in a chat message
 */
export type MediaURLData = MediaURLMetadata;
//# sourceMappingURL=url.d.ts.map