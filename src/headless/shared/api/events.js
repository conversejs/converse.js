import _converse from '../_converse.js';
import { isFunction } from '../../utils/object.js';


export default {
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
     * @param {string} name - The event name
     */
    async trigger (name) {
        if (!_converse._events) {
            return;
        }
        const args = Array.from(arguments);
        const options = /** @type {Options} */(args.pop());
        if (options && options.synchronous) {
            const events = _converse._events[name] || [];
            const event_args = args.splice(1);
            await Promise.all(events.map(e => e.callback.apply(e.ctx, event_args)));
        } else {
            _converse.trigger.apply(_converse, arguments);
        }
        const promise = _converse.promises[name];
        if (promise !== undefined) {
            promise.resolve(arguments[1]);
        }
    },

    /**
     * Triggers a hook which can be intercepted by registered listeners via
     * {@link _converse.api.listen.on} or {@link _converse.api.listen.once}.
     * (see [_converse.api.listen](http://localhost:8000/docs/html/api/-_converse.api.listen.html)).
     * A hook is a special kind of event which allows you to intercept a data
     * structure in order to modify it, before passing it back.
     * @async
     * @param {string} name - The hook name
     * @param {...any} context - The context to which the hook applies
     *  (could be for example, a {@link _converse.ChatBox}).
     * @param {...any} data - The data structure to be intercepted and modified by the hook listeners.
     * @returns {Promise<any>} - A promise that resolves with the modified data structure.
     */
    hook (name, context, data) {
        const events = _converse._events[name] || [];
        if (events.length) {
            // Create a chain of promises, with each one feeding its output to
            // the next. The first input is a promise with the original data
            // sent to this hook.
            return events.reduce((o, e) => o.then(d => e.callback(context, d)), Promise.resolve(data));
        } else {
            return data;
        }
    },

    /**
     * Converse emits events to which you can subscribe to.
     *
     * The `listen` namespace exposes methods for creating event listeners
     * (aka handlers) for these events.
     *
     * @namespace _converse.api.listen
     * @memberOf _converse
     */
    listen: {
        /**
         * Lets you listen to an event exactly once.
         * @method _converse.api.listen.once
         * @param {string} name The event's name
         * @param {function} callback The callback method to be called when the event is emitted.
         * @param {object} [context] The value of the `this` parameter for the callback.
         * @example _converse.api.listen.once('message', function (messageXML) { ... });
         */
        once: _converse.once.bind(_converse),

        /**
         * Lets you subscribe to an event.
         * Every time the event fires, the callback method specified by `callback` will be called.
         * @method _converse.api.listen.on
         * @param {string} name The event's name
         * @param {function} callback The callback method to be called when the event is emitted.
         * @param {object} [context] The value of the `this` parameter for the callback.
         * @example _converse.api.listen.on('message', function (messageXML) { ... });
         */
        on: _converse.on.bind(_converse),

        /**
         * To stop listening to an event, you can use the `not` method.
         * @method _converse.api.listen.not
         * @param {string} name The event's name
         * @param {function} callback The callback method that is to no longer be called when the event fires
         * @example _converse.api.listen.not('message', function (messageXML);
         */
        not: _converse.off.bind(_converse),

        /**
         * An options object which lets you set filter criteria for matching
         * against stanzas.
         * @typedef {object} MatchingOptions
         * @property {string} [ns] - The namespace to match against
         * @property {string} [type] - The stanza type to match against
         * @property {string} [id] - The stanza id to match against
         * @property {string} [from] - The stanza sender to match against
         */

        /**
         * Subscribe to an incoming stanza
         * Every a matched stanza is received, the callback method specified by
         * `callback` will be called.
         * @method _converse.api.listen.stanza
         * @param {string} name The stanza's name
         * @param {MatchingOptions|Function} options Matching options or callback
         * @param {function} handler The callback method to be called when the stanza appears
         */
        stanza (name, options, handler) {
            if (isFunction(options)) {
                handler = /** @type {Function} */(options);
                options = {};
            } else {
                options = options || {};
            }
            _converse.api.connection.get().addHandler(
                handler,
                options.ns,
                name,
                options.type,
                options.id,
                options.from,
                options
            );
        }
    },
}
