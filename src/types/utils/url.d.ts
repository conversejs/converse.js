/**
 * @param {string[]} whitelist
 * @param {string|URL} url
 */
export function isDomainWhitelisted(whitelist: string[], url: string | URL): boolean;
/**
 * @param {string|URL} url
 * @param {string} setting
 */
export function isDomainAllowed(url: string | URL, setting: string): boolean;
/**
 * Accepts a {@link MediaURLData} object and then checks whether its domain is
 * allowed for rendering in the chat.
 * @param {import('@converse/headless/types/utils/types').MediaURLMetadata} o
 * @returns {boolean}
 */
export function isMediaURLDomainAllowed(o: import("@converse/headless/types/utils/types").MediaURLMetadata): boolean;
/**
 * @param {string} url_text
 * @param {"audio"|"image"|"video"} type
 */
export function shouldRenderMediaFromURL(url_text: string, type: "audio" | "image" | "video"): any;
/**
 * Takes the `filter_url_query_params` array from the settings and
 * removes any query strings from the URL that matches those values.
 * @param {string} url
 * @return {string}
 */
export function filterQueryParamsFromURL(url: string): string;
//# sourceMappingURL=url.d.ts.map