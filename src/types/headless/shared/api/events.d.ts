declare namespace _default {
    /**
     * Lets you trigger events, which can be listened to via
     * {@link _converse.api.listen.on} or {@link _converse.api.listen.once}
     * (see [_converse.api.listen](http://localhost:8000/docs/html/api/-_converse.api.listen.html)).
     *
     * Some events also double as promises and can be waited on via {@link _converse.api.waitUntil}.
     *
     * @typedef {object} Options
     * @property {boolean} [Options.synchronous] - Whether the event is synchronous or not.
     *  When a synchronous event is fired, a promise will be returned
     *  by {@link _converse.api.trigger} which resolves once all the
     *  event handlers' promises have been resolved.
     *
     * @method _converse.api.trigger
     * @param { string } name - The event name
     */
    function trigger(name: string, ...args: any[]): Promise<void>;
    /**
     * Triggers a hook which can be intercepted by registered listeners via
     * {@link _converse.api.listen.on} or {@link _converse.api.listen.once}.
     * (see [_converse.api.listen](http://localhost:8000/docs/html/api/-_converse.api.listen.html)).
     * A hook is a special kind of event which allows you to intercept a data
     * structure in order to modify it, before passing it back.
     * @async
     * @param { string } name - The hook name
     * @param {...any} context - The context to which the hook applies (could be for example, a {@link _converse.ChatBox})).
     * @param {...any} data - The data structure to be intercepted and modified by the hook listeners.
     * @returns {Promise<any>} - A promise that resolves with the modified data structure.
     */
    function hook(name: string, context: any, data: any): Promise<any>;
    namespace listen {
        const once: any;
        const on: any;
        const not: any;
        /**
         * Subscribe to an incoming stanza
         * Every a matched stanza is received, the callback method specified by
         * `callback` will be called.
         * @method _converse.api.listen.stanza
         * @param { string } name The stanza's name
         * @param { object } options Matching options (e.g. 'ns' for namespace, 'type' for stanza type, also 'id' and 'from');
         * @param { function } handler The callback method to be called when the stanza appears
         */
        function stanza(name: string, options: any, handler: Function): void;
    }
}
export default _default;
//# sourceMappingURL=events.d.ts.map