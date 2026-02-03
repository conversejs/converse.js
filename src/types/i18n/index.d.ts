/**
 * @param {string} str
 * @param {...(string|number)} args
 */
export function __(str: string, ...args: (string | number)[]): any;
/**
 * @namespace i18n
 */
export const i18n: typeof i18nStub & {
    __: typeof __;
    determineLocale: typeof determineLocale;
    getLocale: typeof getLocale;
    initialize: typeof initialize;
    translate: typeof translate;
};
import { i18n as i18nStub } from '@converse/headless';
/**
 * Determines which locale is supported by the user's system as well
 * as by the relevant library (e.g. converse.js or dayjs).
 * @returns {string}
 */
declare function determineLocale(): string;
declare function getLocale(): string;
declare function initialize(): Promise<void>;
/**
 * @param {string} str - The string to be translated
 * @param {Array<any>} args
 */
declare function translate(str: string, args: Array<any>, ...args: any[]): any;
export {};
//# sourceMappingURL=index.d.ts.map