import { _converse, api } from '../../core';
import { STATUS_WEIGHTS } from '../../shared/constants';


export default {
    /**
     * Set and get the user's chat status, also called their *availability*.
     * @namespace _converse.api.user.status
     * @memberOf _converse.api.user
     */
    status: {
        /**
         * Return the current user's availability status.
         * @async
         * @method _converse.api.user.status.get
         * @example _converse.api.user.status.get();
         */
        async get () {
            await api.waitUntil('statusInitialized');
            return _converse.xmppstatus.get('status');
        },

        /**
         * The user's status can be set to one of the following values:
         *
         * @async
         * @method _converse.api.user.status.set
         * @param { string } value The user's chat status (e.g. 'away', 'dnd', 'offline', 'online', 'unavailable' or 'xa')
         * @param { string } [message] A custom status message
         *
         * @example _converse.api.user.status.set('dnd');
         * @example _converse.api.user.status.set('dnd', 'In a meeting');
         */
        async set (value, message) {
            const data = {'status': value};
            if (!Object.keys(STATUS_WEIGHTS).includes(value)) {
                throw new Error(
                    'Invalid availability value. See https://xmpp.org/rfcs/rfc3921.html#rfc.section.2.2.2.1'
                );
            }
            if (typeof message === 'string') {
                data.status_message = message;
            }
            await api.waitUntil('statusInitialized');
            _converse.xmppstatus.save(data);
        },

        /**
         * Set and retrieve the user's custom status message.
         *
         * @namespace _converse.api.user.status.message
         * @memberOf _converse.api.user.status
         */
        message: {
            /**
             * @async
             * @method _converse.api.user.status.message.get
             * @returns { Promise<string> } The status message
             * @example const message = _converse.api.user.status.message.get()
             */
            async get () {
                await api.waitUntil('statusInitialized');
                return _converse.xmppstatus.get('status_message');
            },
            /**
             * @async
             * @method _converse.api.user.status.message.set
             * @param { string } status The status message
             * @example _converse.api.user.status.message.set('In a meeting');
             */
            async set (status) {
                await api.waitUntil('statusInitialized');
                _converse.xmppstatus.save({ status_message: status });
            }
        }
    }
}
