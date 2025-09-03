import api from '../../shared/api/index.js';
import _converse from '../../shared/_converse.js';
import { PRES_SHOW_VALUES, PRES_TYPE_VALUES, STATUS_WEIGHTS } from '../../shared/constants';

let idle_seconds = 0;
let idle = false;

export default {
    /**
     * Set and get the user's chat status, also called their *availability*.
     * @namespace _converse.api.user.status
     * @memberOf _converse.api.user
     */
    status: {
        /**
         * Return the current user's availability status.
         * @method _converse.api.user.status.get
         * @example _converse.api.user.status.get();
         */
        async get() {
            await api.waitUntil('statusInitialized');

            const show = _converse.state.profile.get('show');
            if (show) {
                return show;
            }
            const status = _converse.state.profile.get('status');
            if (!status) {
                return 'online';
            }
            return status;
        },

        /**
         * The user's status can be set to one of the following values:
         * @method _converse.api.user.status.set
         * @param { string } value The user's chat status (e.g. 'away', 'dnd', 'offline', 'online', 'unavailable' or 'xa')
         * @param { string } [message] A custom status message
         *
         * @example _converse.api.user.status.set('dnd');
         * @example _converse.api.user.status.set('dnd', 'In a meeting');
         */
        async set(value, message) {
            if (!Object.keys(STATUS_WEIGHTS).includes(value)) {
                throw new Error(
                    'Invalid availability value. See https://xmpp.org/rfcs/rfc3921.html#rfc.section.2.2.2.1'
                );
            }

            let show = PRES_SHOW_VALUES.includes(value) ? value : undefined;
            if (value === 'away') {
                show = 'dnd';
            }

            const type = PRES_TYPE_VALUES.includes(value) ? value : undefined;
            const data = { show, type };

            if (typeof message === 'string') {
                data.status_message = message;
            }
            await api.waitUntil('statusInitialized');
            _converse.state.profile.save(data);
        },

        /**
         * Set and retrieve the user's custom status message.
         *
         * @namespace _converse.api.user.status.message
         * @memberOf _converse.api.user.status
         */
        message: {
            /**
             * @method _converse.api.user.status.message.get
             * @returns {Promise<string>} The status message
             * @example const message = _converse.api.user.status.message.get()
             */
            async get() {
                await api.waitUntil('statusInitialized');
                return _converse.state.profile.get('status_message');
            },
            /**
             * @method _converse.api.user.status.message.set
             * @param {string} status The status message
             * @example _converse.api.user.status.message.set('In a meeting');
             */
            async set(status) {
                await api.waitUntil('statusInitialized');
                _converse.state.profile.save({ status_message: status });
            },
        },
    },

    /**
     * Set and get the user's idle status
     * @namespace _converse.api.user.idle
     * @memberOf _converse.api.user
     */
    idle: {
        /**
         * @method _converse.api.user.idle.get
         * @returns {import('./types').IdleStatus}
         * @example _converse.api.user.idle.get();
         */
        get() {
            return { idle, seconds: idle_seconds };
        },

        /**
         * @method _converse.api.user.idle.set
         * @param {import('./types').IdleStatus} status
         */
        set(status) {
            if (status.idle) {
                idle = status.idle;
            }
            if (typeof status.seconds === 'number') {
                idle_seconds = status.seconds;
            }
        },
    },
};
