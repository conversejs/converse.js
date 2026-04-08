/**
 * If it already looks like a shortname, use it directly.
 * Otherwise try to resolve it via codepoint.
 *
 * @param {string} emoji - A unicode emoji or shortname
 */
export function emojiToShortname(emoji: string): any;
/**
 * Convert a unicode emoji string to its codepoint key as used in the emoji data
 * (e.g. '❤️' → '2764-fe0f', '👍' → '1f44d').
 * @param {string} emoji
 * @returns {string}
 */
export function emojiToCodepointKey(emoji: string): string;
/**
 * @param {string} str
 */
export function convertASCII2Emoji(str: string): string;
/**
 * @param {string} text
 * @returns {import('./types').EmojiReference[]}
 */
export function getShortnameReferences(text: string): import("./types").EmojiReference[];
/**
 * @param {string} text
 * @returns {import('./types').EmojiReference[]}
 */
export function getCodePointReferences(text: string): import("./types").EmojiReference[];
/**
 * Determines whether the passed in string is just a single emoji shortname;
 * @namespace u
 * @method u.isOnlyEmojis
 * @param {String} text - A string which might be just an emoji shortname
 * @returns {Boolean}
 */
export function isOnlyEmojis(text: string): boolean;
//# sourceMappingURL=utils.d.ts.map