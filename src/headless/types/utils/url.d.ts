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
 * @param {string} text
 * @param {number} offset
 * @returns {{media_urls?: import("./types").MediaURLMetadata[]}}
 */
export function getMediaURLsMetadata(text: string, offset?: number): {
    media_urls?: import("./types").MediaURLMetadata[];
};
/**
 * Given an array of {@link MediaURLMetadata} objects and text, return an
 * array of {@link MediaURL} objects.
 * @param {Array<import("./types").MediaURLMetadata>} arr
 * @param {string} text
 * @returns {import("./types").MediaURLData[]}
 */
export function getMediaURLs(arr: Array<import("./types").MediaURLMetadata>, text: string, offset?: number): import("./types").MediaURLData[];
//# sourceMappingURL=url.d.ts.map