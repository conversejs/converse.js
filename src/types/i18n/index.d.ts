export const __: typeof i18nStub.__ & ((str: any, ...args: any[]) => any);
/**
 * @namespace i18n
 */
export const i18n: typeof i18nStub & {
    getLocale(): string;
    /**
     * @param {string} str - The string to be translated
     * @param {Array<any>} args
     */
    translate(str: string, args: Array<any>, ...args: any[]): any;
    initialize(): Promise<void>;
    __(str: any, ...args: any[]): any;
};
import { i18n as i18nStub } from "@converse/headless";
//# sourceMappingURL=index.d.ts.map