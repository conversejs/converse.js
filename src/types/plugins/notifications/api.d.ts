declare namespace _default {
    namespace notifications {
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
        function isNotable(data: import("./types").MessageNotificationData): Promise<boolean>;
    }
}
export default _default;
//# sourceMappingURL=api.d.ts.map