/**
 * @param {string} str
 */
export function convertASCII2Emoji(str: string): string;
/**
 * @param {string} text
 */
export function getShortnameReferences(text: string): {
    cp: any;
    begin: number;
    end: number;
    shortname: string;
    emoji: string;
}[];
/**
 * @param {string} text
 */
export function getCodePointReferences(text: string): any[];
/**
 * Determines whether the passed in string is just a single emoji shortname;
 * @namespace u
 * @method u.isOnlyEmojis
 * @param { String } text - A string which might be just an emoji shortname
 * @returns { Boolean }
 */
export function isOnlyEmojis(text: string): boolean;
//# sourceMappingURL=utils.d.ts.map