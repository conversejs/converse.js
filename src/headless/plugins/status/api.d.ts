declare namespace _default {
    namespace presence {
        /**
         * Send out a presence stanza
         * @method _converse.api.user.presence.send
         * @param { String } type
         * @param { String } to
         * @param { String } [status] - An optional status message
         * @param { Element[]|Strophe.Builder[]|Element|Strophe.Builder } [child_nodes]
         *  Nodes(s) to be added as child nodes of the `presence` XML element.
         */
        function send(type: string, to: string, status?: string, child_nodes?: any): Promise<void>;
    }
    namespace status {
        /**
         * Return the current user's availability status.
         * @async
         * @method _converse.api.user.status.get
         * @example _converse.api.user.status.get();
         */
        function get(): Promise<any>;
        /**
         * The user's status can be set to one of the following values:
         *
         * @async
         * @method _converse.api.user.status.set
         * @param {string} value The user's chat status (e.g. 'away', 'dnd', 'offline', 'online', 'unavailable' or 'xa')
         * @param {string} [message] A custom status message
         *
         * @example _converse.api.user.status.set('dnd');
         * @example _converse.api.user.status.set('dnd', 'In a meeting');
         */
        function set(value: string, message?: string): Promise<void>;
        namespace message {
            /**
             * @async
             * @method _converse.api.user.status.message.get
             * @returns {string} The status message
             * @example const message = _converse.api.user.status.message.get()
             */
            function get(): string;
            /**
             * @async
             * @method _converse.api.user.status.message.set
             * @param {string} status The status message
             * @example _converse.api.user.status.message.set('In a meeting');
             */
            function set(status: string): Promise<void>;
        }
    }
}
export default _default;
