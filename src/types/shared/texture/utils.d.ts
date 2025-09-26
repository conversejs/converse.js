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
 * @param {any} s
 * @returns {boolean} - Returns true if the input is a string, otherwise false.
 */
export function isString(s: any): boolean;
/**
 * @param {string} url
 * @returns {boolean}
 */
export function isSpotifyTrack(url: string): boolean;
/**
 * @param {string} url
 * @returns {Promise<Headers>}
 */
export function getHeaders(url: string): Promise<Headers>;
/**
 * We don't render more than two line-breaks, replace extra line-breaks with
 * the zero-width whitespace character
 * This takes into account other characters that may have been removed by
 * being replaced with a zero-width space, such as '> ' in the case of
 * multi-line quotes.
 * @param {string} text
 */
export function collapseLineBreaks(text: string): string;
export function tplMention(o: any): import("lit-html").TemplateResult<1>;
/**
 * @param {import('./texture').Texture} text
 * @param {number} i
 */
export function getDirectiveAndLength(text: import("./texture").Texture, i: number): {
    d: string;
    length: number;
} | {
    d?: undefined;
    length?: undefined;
};
/**
 * @param {string} d
 */
export function isQuoteDirective(d: string): boolean;
/**
 * @param {import('./texture').Texture} text
 * @returns {boolean}
 */
export function containsDirectives(text: import("./texture").Texture): boolean;
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
 */
export function isGIFURL(url: string | URL): boolean;
/**
 * @param {string|URL} url
 * @param {Headers} [headers]
 */
export function isAudioURL(url: string | URL, headers?: Headers): boolean;
/**
 * @param {string|URL} url
 * @param {Headers} [headers]
 */
export function isVideoURL(url: string | URL, headers?: Headers): boolean;
/**
 * @param {string|URL} url
 * @returns {boolean}
 */
export function isURLWithImageExtension(url: string | URL): boolean;
/**
 * @param {string|URL} url
 * @param {Headers} [headers]
 * @returns {boolean}
 */
export function isImageURL(url: string | URL, headers?: Headers): boolean;
/**
 * @param {string|URL} url
 */
export function isEncryptedFileURL(url: string | URL): boolean;
/**
 * @param {import("./types").MediaURLIndexes} o
 * @returns {Promise<import("./types").MediaURLMetadata>}
 */
export function getMetadataForURL(o: import("./types").MediaURLIndexes): Promise<import("./types").MediaURLMetadata>;
/**
 * @param {string} text
 * @param {number} offset
 * @returns {Promise<{media_urls?: import("./types").MediaURLMetadata[]}>}
 */
export function getMediaURLsMetadata(text: string, offset?: number): Promise<{
    media_urls?: import("./types").MediaURLMetadata[];
}>;
/**
 * @param {Array<import("./types.ts").MediaURLMetadata>} arr
 * @param {string} text
 * @returns {import("./types.ts").MediaURLMetadata[]}
 */
export function addMediaURLsOffset(arr: Array<import("./types.ts").MediaURLMetadata>, text: string, offset?: number): import("./types.ts").MediaURLMetadata[];
export function tplMentionWithNick(o: any): import("lit-html").TemplateResult<1>;
//# sourceMappingURL=utils.d.ts.map