/**
 * Will return false if URL is malformed or contains disallowed characters
 * @param {string} text
 * @returns {boolean}
 */
export function isValidURL(text: string): boolean;
/**
 * @param {string|URL} url
 * @returns {URL}
 */
export function getURL(url: string | URL): URL;
/**
 * Given the an array of file extensions, check whether a URL points to a file
 * ending in one of them.
 * @param {string[]} types - An array of file extensions
 * @param {string|URL} url
 * @returns {boolean}
 * @example
 *  checkFileTypes(['.gif'], 'https://conversejs.org/cat.gif?foo=bar');
 */
export function checkFileTypes(types: string[], url: string | URL): boolean;
/**
 * @param {string|URL} url
 * @returns {boolean}
 */
export function isURLWithImageExtension(url: string | URL): boolean;
/**
 * @param {string|URL} url
 */
export function isGIFURL(url: string | URL): boolean;
/**
 * @param {string|URL} url
 */
export function isAudioURL(url: string | URL): boolean;
/**
 * @param {string|URL} url
 */
export function isVideoURL(url: string | URL): boolean;
/**
 * @param {string|URL} url
 * @returns {boolean}
 */
export function isImageURL(url: string | URL): boolean;
/**
 * @param {string|URL} url
 */
export function isEncryptedFileURL(url: string | URL): boolean;
/**
 * Processes a string to find and manipulate substrings based on a callback function.
 * This function searches for patterns defined by the provided start and end regular expressions,
 * and applies the callback to each matched substring, allowing for modifications
 * @copyright Copyright (c) 2011 Rodney Rehm
 *
 * @param {string} string - The input string to be processed.
 * @param {function} callback - A function that takes the matched substring and its start and end indices,
 *                              and returns a modified substring or undefined to skip modification.
 * @param {import("./types").ProcessStringOptions} [options]
 * @returns {string} The modified string after processing all matches.
 */
export function withinString(string: string, callback: Function, options?: import("./types").ProcessStringOptions): string;
/**
 * @param {string} text
 * @param {number} offset
 * @returns {{media_urls?: import("./types").MediaURLMetadata[]}}
 */
export function getMediaURLsMetadata(text: string, offset?: number): {
    media_urls?: import("./types").MediaURLMetadata[];
};
/**
 * @param {Array<import("./types").MediaURLMetadata>} arr
 * @param {string} text
 * @returns {import("./types").MediaURLMetadata[]}
 */
export function getMediaURLs(arr: Array<import("./types").MediaURLMetadata>, text: string): import("./types").MediaURLMetadata[];
/**
 * @param {Array<import("./types").MediaURLMetadata>} arr
 * @param {string} text
 * @returns {import("./types").MediaURLMetadata[]}
 */
export function addMediaURLsOffset(arr: Array<import("./types").MediaURLMetadata>, text: string, offset?: number): import("./types").MediaURLMetadata[];
//# sourceMappingURL=url.d.ts.map