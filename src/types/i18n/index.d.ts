export function __(str: any, ...args: any[]): any;
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
 * @param {string} preferred_locale
 * @param {Function} isSupportedByLibrary - Returns a boolean indicating whether
 *   the locale is supported.
 * @returns {string}
 */
declare function determineLocale(preferred_locale: string, isSupportedByLibrary: Function): string;
declare function getLocale(): string;
declare function initialize(): Promise<void>;
/**
 * @param {string} str - The string to be translated
 * @param {Array<any>} args
 */
declare function translate(str: string, args: Array<any>, ...args: any[]): any;
export {};
//# sourceMappingURL=index.d.ts.map