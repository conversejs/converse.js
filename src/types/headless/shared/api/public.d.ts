/**
 * @typedef {Window & {converse: ConversePrivateGlobal} } window
 *
 * ### The Public API
 *
 * This namespace contains public API methods which are are
 * accessible on the global `converse` object.
 * They are public, because any JavaScript in the
 * page can call them. Public methods therefore don’t expose any sensitive
 * or closured data. To do that, you’ll need to create a plugin, which has
 * access to the private API method.
 *
 * @global
 * @namespace converse
 */
export const converse: any;
export type ConversePrivateGlobal = any;
/**
 * ### The Public API
 *
 * This namespace contains public API methods which are are
 * accessible on the global `converse` object.
 * They are public, because any JavaScript in the
 * page can call them. Public methods therefore don’t expose any sensitive
 * or closured data. To do that, you’ll need to create a plugin, which has
 * access to the private API method.
 */
export type window = Window & {
    converse: ConversePrivateGlobal;
};
//# sourceMappingURL=public.d.ts.map