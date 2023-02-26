import _converse from '@converse/headless/shared/_converse.js';
import { getOpenPromise } from '@converse/openpromise';
import { waitUntil, isFunction } from '../../utils/core.js';

export default {
    /**
     * Converse and its plugins trigger various events which you can listen to via the
     * {@link _converse.api.listen} namespace.
     *
     * Some of these events are also available as [ES2015 Promises](http://es6-features.org/#PromiseUsage)
     * although not all of them could logically act as promises, since some events
     * might be fired multpile times whereas promises are to be resolved (or
     * rejected) only once.
     *
     * Events which are also promises include:
     *
     * * [cachedRoster](/docs/html/events.html#cachedroster)
     * * [chatBoxesFetched](/docs/html/events.html#chatBoxesFetched)
     * * [pluginsInitialized](/docs/html/events.html#pluginsInitialized)
     * * [roster](/docs/html/events.html#roster)
     * * [rosterContactsFetched](/docs/html/events.html#rosterContactsFetched)
     * * [rosterGroupsFetched](/docs/html/events.html#rosterGroupsFetched)
     * * [rosterInitialized](/docs/html/events.html#rosterInitialized)
     *
     * The various plugins might also provide promises, and they do this by using the
     * `promises.add` api method.
     *
     * @namespace _converse.api.promises
     * @memberOf _converse.api
     */
    promises: {
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
         * @param { boolean } [replace=true] Whether this promise should be replaced with a new one when the user logs out.
         * @example _converse.api.promises.add('foo-completed');
         */
        add (promises, replace=true) {
            promises = Array.isArray(promises) ? promises : [promises];
            promises.forEach(name => {
                const promise = getOpenPromise();
                promise.replace = replace;
                _converse.promises[name] = promise;
            });
        }
    },

    /**
     * Wait until a promise is resolved or until the passed in function returns
     * a truthy value.
     * @method _converse.api.waitUntil
     * @param {string|function} condition - The name of the promise to wait for,
     * or a function which should eventually return a truthy value.
     * @returns {Promise}
     */
    waitUntil (condition) {
        if (isFunction(condition)) {
            return waitUntil(condition);
        } else {
            const promise = _converse.promises[condition];
            if (promise === undefined) {
                return null;
            }
            return promise;
        }
    },
}
