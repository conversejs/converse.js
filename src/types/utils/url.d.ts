export function isDomainWhitelisted(whitelist: any, url: any): any;
export function isDomainAllowed(url: any, setting: any): any;
/**
 * Accepts a {@link MediaURLData} object and then checks whether its domain is
 * allowed for rendering in the chat.
 * @param {MediaURLData} o
 * @returns {boolean}
 */
export function isMediaURLDomainAllowed(o: MediaURLData): boolean;
/**
 * @param {string} url_text
 * @param {"audio"|"image"|"video"} type
 */
export function shouldRenderMediaFromURL(url_text: string, type: "audio" | "image" | "video"): any;
export type MediaURLData = any;
//# sourceMappingURL=url.d.ts.map