/**
 * Will return false if URL is malformed or contains disallowed characters
 * @param {string} text
 * @returns {boolean}
 */
export function isValidURL(text: string): boolean;
/**
 * Given a url, check whether the protocol being used is allowed for rendering
 * the media in the chat (as opposed to just rendering a URL hyperlink).
 * @param {string} url
 * @returns {boolean}
 */
export function isAllowedProtocolForMedia(url: string): boolean;
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
export function isDomainWhitelisted(whitelist: any, url: any): any;
export function shouldRenderMediaFromURL(url_text: any, type: any): any;
export function filterQueryParamsFromURL(url: any): any;
export function isDomainAllowed(url: any, setting: any): any;
/**
 * Accepts a {@link MediaURLData} object and then checks whether its domain is
 * allowed for rendering in the chat.
 * @param {MediaURLData} o
 * @returns {boolean}
 */
export function isMediaURLDomainAllowed(o: any): boolean;
export function isURLWithImageExtension(url: any): boolean;
export function isGIFURL(url: any): boolean;
export function isAudioURL(url: any): boolean;
export function isVideoURL(url: any): boolean;
export function isImageURL(url: any): any;
export function isEncryptedFileURL(url: any): any;
export type MediaURLData = any;
//# sourceMappingURL=url.d.ts.map