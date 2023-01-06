export namespace api {
    export { connection_api as connection };
    export { settings_api as settings };
    /**
     * Lets you trigger events, which can be listened to via
     * {@link _converse.api.listen.on} or {@link _converse.api.listen.once}
     * (see [_converse.api.listen](http://localhost:8000/docs/html/api/-_converse.api.listen.html)).
     *
     * Some events also double as promises and can be waited on via {@link _converse.api.waitUntil}.
     *
     * @method _converse.api.trigger
     * @param {string} name - The event name
     * @param {...any} [argument] - Argument to be passed to the event handler
     * @param {object} [options]
     * @param {boolean} [options.synchronous] - Whether the event is synchronous or not.
     *  When a synchronous event is fired, a promise will be returned
     *  by {@link _converse.api.trigger} which resolves once all the
     *  event handlers' promises have been resolved.
     */
    export function trigger(name: string, ...args: any[]): Promise<void>;
    /**
     * Triggers a hook which can be intercepted by registered listeners via
     * {@link _converse.api.listen.on} or {@link _converse.api.listen.once}.
     * (see [_converse.api.listen](http://localhost:8000/docs/html/api/-_converse.api.listen.html)).
     * A hook is a special kind of event which allows you to intercept a data
     * structure in order to modify it, before passing it back.
     * @async
     * @param {string} name - The hook name
     * @param {...any} context - The context to which the hook applies (could be for example, a {@link _converse.ChatBox)).
     * @param {...any} data - The data structure to be intercepted and modified by the hook listeners.
     * @returns {Promise<any>} - A promise that resolves with the modified data structure.
     */
    export function hook(name: string, context: any, data: any): Promise<any>;
    export namespace user {
        export { user_settings_api as settings };
        /**
         * @method _converse.api.user.jid
         * @returns {string} The current user's full JID (Jabber ID)
         * @example _converse.api.user.jid())
         */
        export function jid(): string;
        /**
         * Logs the user in.
         *
         * If called without any parameters, Converse will try
         * to log the user in by calling the `prebind_url` or `credentials_url` depending
         * on whether prebinding is used or not.
         *
         * @method _converse.api.user.login
         * @param {string} [jid]
         * @param {string} [password]
         * @param {boolean} [automatic=false] - An internally used flag that indicates whether
         *  this method was called automatically once the connection has been
         *  initialized. It's used together with the `auto_login` configuration flag
         *  to determine whether Converse should try to log the user in if it
         *  fails to restore a previous auth'd session.
         *  @returns  {void}
         */
        export function login(jid?: string, password?: string, automatic?: boolean): void;
        /**
         * Logs the user out of the current XMPP session.
         * @method _converse.api.user.logout
         * @example _converse.api.user.logout();
         */
        export function logout(): Promise<any>;
    }
    export namespace promises {
        /**
         * By calling `promises.add`, a new [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
         * is made available for other code or plugins to depend on via the
         * {@link _converse.api.waitUntil} method.
         *
         * Generally, it's the responsibility of the plugin which adds the promise to
         * also resolve it.
         *
         * This is done by calling {@link _converse.api.trigger}, which not only resolves the
         * promise, but also emits an event with the same name (which can be listened to
         * via {@link _converse.api.listen}).
         *
         * @method _converse.api.promises.add
         * @param {string|array} [name|names] The name or an array of names for the promise(s) to be added
         * @param {boolean} [replace=true] Whether this promise should be replaced with a new one when the user logs out.
         * @example _converse.api.promises.add('foo-completed');
         */
        function add(promises: any, replace?: boolean): void;
    }
    export namespace listen {
        const once: any;
        const on: any;
        const not: any;
        /**
         * Subscribe to an incoming stanza
         * Every a matched stanza is received, the callback method specified by
         * `callback` will be called.
         * @method _converse.api.listen.stanza
         * @param {string} name The stanza's name
         * @param {object} options Matching options (e.g. 'ns' for namespace, 'type' for stanza type, also 'id' and 'from');
         * @param {function} handler The callback method to be called when the stanza appears
         */
        function stanza(name: string, options: any, handler: Function): void;
    }
    /**
     * Wait until a promise is resolved or until the passed in function returns
     * a truthy value.
     * @method _converse.api.waitUntil
     * @param {string|function} condition - The name of the promise to wait for,
     * or a function which should eventually return a truthy value.
     * @returns {Promise}
     */
    export function waitUntil(condition: string | Function): Promise<any>;
    /**
     * Allows you to send XML stanzas.
     * @method _converse.api.send
     * @param {Element} stanza
     * @return {void}
     * @example
     * const msg = converse.env.$msg({
     *     'from': 'juliet@example.com/balcony',
     *     'to': 'romeo@example.net',
     *     'type':'chat'
     * });
     * _converse.api.send(msg);
     */
    export function send(stanza: Element): void;
    /**
     * Send an IQ stanza
     * @method _converse.api.sendIQ
     * @param {Element} stanza
     * @param {number} [timeout=_converse.STANZA_TIMEOUT]
     * @param {Boolean} [reject=true] - Whether an error IQ should cause the promise
     *  to be rejected. If `false`, the promise will resolve instead of being rejected.
     * @returns {Promise} A promise which resolves (or potentially rejected) once we
     *  receive a `result` or `error` stanza or once a timeout is reached.
     *  If the IQ stanza being sent is of type `result` or `error`, there's
     *  nothing to wait for, so an already resolved promise is returned.
     */
    export function sendIQ(stanza: Element, timeout?: number, reject?: boolean): Promise<any>;
}
/**
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
import _converse from "./shared/_converse";
import i18n from "./shared/i18n";
import connection_api from "./shared/connection/api.js";
import { settings_api } from "./shared/settings/api.js";
import { user_settings_api } from "./shared/settings/api.js";
export { _converse, i18n };
