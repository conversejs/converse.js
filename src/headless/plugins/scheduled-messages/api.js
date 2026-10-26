import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import u from '../../utils/index.js';

const scheduled_messages_api = {
    scheduledMessages: {
        /**
         * Persist a message for later delivery.
         * @param {Object} attrs
         * @param {string} attrs.to
         * @param {string} attrs.body
         * @param {string|Date} attrs.send_at
         * @param {Record<string, unknown>} [attrs.metadata]
         */
        async schedule({ to, body, send_at, metadata = {} }) {
            const at = new Date(send_at);
            if (typeof to !== 'string' || !to || typeof body !== 'string' || !body.trim()) {
                throw new TypeError('A scheduled message needs a recipient and a non-empty body.');
            }
            if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) {
                throw new TypeError('A scheduled message needs a valid delivery time in the future.');
            }
            await api.waitUntil('scheduledMessagesInitialized');
            return _converse.state.scheduled_messages.schedule({
                id: u.getUniqueId('scheduled'),
                to,
                body,
                send_at: at.toISOString(),
                created: new Date().toISOString(),
                metadata,
            });
        },

        /** Return one scheduled message, or all of them in delivery order. */
        async get(id) {
            await api.waitUntil('scheduledMessagesInitialized');
            const schedules = _converse.state.scheduled_messages;
            return id === undefined ? [...schedules.models] : schedules.get(id);
        },

        /** Cancel a scheduled message, returning it when it existed. */
        async cancel(id) {
            await api.waitUntil('scheduledMessagesInitialized');
            return _converse.state.scheduled_messages.cancel(id);
        },
    },
};

export default scheduled_messages_api;
