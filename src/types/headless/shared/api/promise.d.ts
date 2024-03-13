declare namespace _default {
    namespace promises {
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
         * @param {string|array} [promises] The name or an array of names for the promise(s) to be added
         * @param {boolean} [replace=true] Whether this promise should be replaced with a new one when the user logs out.
         * @example _converse.api.promises.add('foo-completed');
         */
        function add(promises?: string | any[], replace?: boolean): void;
    }
    /**
     * Wait until a promise is resolved or until the passed in function returns
     * a truthy value.
     * @method _converse.api.waitUntil
     * @param {string|function} condition - The name of the promise to wait for,
     * or a function which should eventually return a truthy value.
     * @returns {Promise}
     */
    function waitUntil(condition: string | Function): Promise<any>;
}
export default _default;
//# sourceMappingURL=promise.d.ts.map