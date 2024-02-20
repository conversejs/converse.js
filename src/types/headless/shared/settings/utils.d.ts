export function getAppSettings(): any;
export function initAppSettings(settings: any): void;
export function getInitSettings(): {};
export function getAppSetting(key: any): any;
export function extendAppSettings(settings: any): void;
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
export function getUserSettings(): Promise<any>;
export function updateUserSettings(data: any, options: any): Promise<any>;
export function clearUserSettings(): Promise<any>;
//# sourceMappingURL=utils.d.ts.map