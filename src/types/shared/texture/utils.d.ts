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
 * Detect URL ranges in a text string so that characters inside URLs
 * (e.g. underscores) are not mistakenly treated as styling directives.
 * @param {string} text
 * @returns {Array<[number, number]>} - Array of [start, end) index pairs
 * @see https://github.com/conversejs/converse.js/issues/2857
 */
export function getUrlRanges(text: string): Array<[number, number]>;
/**
 * @param {import('./texture').Texture} text
 * @returns {boolean}
 */
export function containsDirectives(text: import("./texture").Texture): boolean;
export function tplMentionWithNick(o: any): import("lit-html").TemplateResult<1>;
//# sourceMappingURL=utils.d.ts.map