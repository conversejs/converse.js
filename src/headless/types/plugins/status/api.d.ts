declare namespace _default {
    namespace status {
        /**
         * Return the current user's availability status.
         * @method _converse.api.user.status.get
         * @example _converse.api.user.status.get();
         */
        function get(): Promise<any>;
        /**
         * The user's status can be set to one of the following values:
         * @method _converse.api.user.status.set
         * @param { string } value The user's chat status (e.g. 'away', 'dnd', 'offline', 'online', 'unavailable' or 'xa')
         * @param { string } [message] A custom status message
         *
         * @example _converse.api.user.status.set('dnd');
         * @example _converse.api.user.status.set('dnd', 'In a meeting');
         */
        function set(value: string, message?: string): Promise<void>;
        namespace message {
            /**
             * @method _converse.api.user.status.message.get
             * @returns {Promise<string>} The status message
             * @example const message = _converse.api.user.status.message.get()
             */
            function get(): Promise<string>;
            /**
             * @method _converse.api.user.status.message.set
             * @param {string} status The status message
             * @example _converse.api.user.status.message.set('In a meeting');
             */
            function set(status: string): Promise<void>;
        }
    }
    namespace idle {
        /**
         * @method _converse.api.user.idle.get
         * @returns {Promise<import('./types').IdleStatus>}
         * @example _converse.api.user.idle.get();
         */
        function get(): Promise<import("./types").IdleStatus>;
        /**
         * @method _converse.api.user.idle.set
         * @param {import('./types').IdleStatus} status
         */
        function set(status: import("./types").IdleStatus): void;
    }
}
export default _default;
//# sourceMappingURL=api.d.ts.map