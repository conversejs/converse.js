export function getAppSettings(): any;
export function initAppSettings(settings: any): void;
export function getInitSettings(): {};
export function getAppSetting(key: any): any;
/**
 * @param {Object} settings - New settings (or new defaults for existing settings).
 * @param {Object} [options]
 * @param {string[]} [options.deep_merge] - Keys whose user-provided object value
 *  should be deep-merged onto the default instead of replacing it wholesale. The
 *  setting must be a plain object (see {@link deepMergeSetting}).
 */
export function extendAppSettings(settings: any, options?: {
    deep_merge?: string[];
}): void;
/**
 * @param {string} name
 * @param {Function} func
 * @param {any} context
 */
export function registerListener(name: string, func: Function, context: any): void;
/**
 * @param {string} name
 * @param {Function} func
 */
export function unregisterListener(name: string, func: Function): void;
/**
 * @param {Object|string} key An object containing config settings or alternatively a string key
 * @param {string} [val] The value, if the previous parameter is a key
 */
export function updateAppSettings(key: any | string, val?: string): any;
//# sourceMappingURL=utils.d.ts.map