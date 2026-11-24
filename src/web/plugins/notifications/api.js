import { isNotableMessage } from './utils.js';

export default {
    /**
     * The "notifications" namespace groups methods pertaining to notifying
     * the user of new messages.
     *
     * @namespace _converse.api.notifications
     * @memberOf _converse.api
     */
    notifications: {
        /**
         * Whether a received message is worth drawing the user's attention to,
         * according to the notification settings. This doesn't consider
         * whether the user is already looking at the chat it was received in.
         * @method _converse.api.notifications.isNotable
         * @param {import('./types').MessageNotificationData} data - The data of the `message` event
         * @returns {Promise<boolean>}
         * @example
         * api.listen.on('message', async (data) => {
         *     if (await api.notifications.isNotable(data)) {
         *         // ...
         *     }
         * });
         */
        isNotable(data) {
            return isNotableMessage(data);
        },
    },
};
