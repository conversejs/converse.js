export function isMobileViewport(): boolean;
/**
 * @param {import('@converse/headless/types/shared/chatbox').default} model
 */
export function getChatStyle(model: import("@converse/headless/types/shared/chatbox").default): string;
/**
 * @param {import('@converse/headless').Model} model
 */
export function getUnreadMsgsDisplay(model: import("@converse/headless").Model): any;
/**
 * @param {Promise<HeadingButtonAttributes>|HeadingButtonAttributes} promise_or_data
 * @returns {Promise<TemplateResult|''>}
 */
export function getHeadingDropdownItem(promise_or_data: Promise<HeadingButtonAttributes> | HeadingButtonAttributes): Promise<TemplateResult | "">;
/**
 * @param {Promise<HeadingButtonAttributes>|HeadingButtonAttributes} promise_or_data
 * @returns {Promise<TemplateResult>}
 */
export function getHeadingStandaloneButton(promise_or_data: Promise<HeadingButtonAttributes> | HeadingButtonAttributes): Promise<TemplateResult>;
/**
 * @param {Promise<Array<HeadingButtonAttributes>>} promise
 */
export function getStandaloneButtons(promise: Promise<Array<HeadingButtonAttributes>>): Promise<import("lit-html/directive.js").DirectiveResult<{
    new (_partInfo: import("lit-html/directive.js").PartInfo): import("lit-html/directives/until.js").UntilDirective<string | Promise<TemplateResult>>;
}>[]>;
/**
 * @param {Promise<Array<object>>} promise
 */
export function getDropdownButtons(promise: Promise<Array<object>>): Promise<import("lit-html").TemplateResult<1> | "">;
export function onScrolledDown(model: any): void;
/**
 * Given a message object, returns a TemplateResult indicating a new day if
 * the passed in message is more than a day later than its predecessor.
 * @param {Message} message
 * @returns {TemplateResult|undefined}
 */
export function getDayIndicator(message: Message): TemplateResult | undefined;
/**
 * @param {MUCMessage} message
 */
export function getHats(message: MUCMessage): any[];
export function getTonedEmojis(): any;
/**
 * @param {object} data
 * @param {import('./types').EmojiMarkupOptions} options
 */
export function getEmojiMarkup(data: object, options?: import("./types").EmojiMarkupOptions): any;
/**
 * @param {string} text
 * @param {import('./types').EmojiMarkupOptions} options
 */
export function addEmojisMarkup(text: string, options: import("./types").EmojiMarkupOptions): string[];
/**
 * Returns an emoji represented by the passed in shortname.
 * Scans the passed in text for shortnames and replaces them with
 * emoji unicode glyphs or alternatively if it's a custom emoji
 * without unicode representation then a lit TemplateResult
 * which represents image tag markup is returned.
 *
 * The shortname needs to be defined in `emojis.json`
 * and needs to have either a `cp` attribute for the codepoint, or
 * an `url` attribute which points to the source for the image.
 *
 * @param {String} str - String containing the shortname(s)
 * @param {import('./types').EmojiMarkupOptions} options
 * @returns {Array} An array of at least one string, or otherwise
 * strings and lit TemplateResult objects.
 */
export function shortnamesToEmojis(str: string, options?: import("./types").EmojiMarkupOptions): any[];
export type HeadingButtonAttributes = import("plugins/chatview/types").HeadingButtonAttributes;
export type Message = import("@converse/headless").Message;
export type MUCMessage = import("@converse/headless").MUCMessage;
export type TemplateResult = import("lit").TemplateResult;
//# sourceMappingURL=utils.d.ts.map