/**
 * We distinguish between UniView and MultiView instances.
 *
 * UniView means that only one chat is visible, even though there might be multiple ongoing chats.
 * MultiView means that multiple chats may be visible simultaneously.
 */
export function isUniView(): boolean;
export function isTestEnv(): boolean;
export function getUnloadEvent(): "pagehide" | "beforeunload" | "unload";
/**
 * @param {ConversePrivateGlobal} _converse
 * @param {string} name
 */
export function replacePromise(_converse: ConversePrivateGlobal, name: string): void;
/**
 * @param {ConversePrivateGlobal} _converse
 * @returns {boolean}
 */
export function shouldClearCache(_converse: ConversePrivateGlobal): boolean;
/**
 * @param {ConversePrivateGlobal} _converse
 */
export function tearDown(_converse: ConversePrivateGlobal): Promise<any>;
/**
 * @param {ConversePrivateGlobal} _converse
 */
export function clearSession(_converse: ConversePrivateGlobal): any;
export type ConversePrivateGlobal = any;
//# sourceMappingURL=session.d.ts.map