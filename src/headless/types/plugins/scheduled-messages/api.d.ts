export default scheduled_messages_api;
declare namespace scheduled_messages_api {
    namespace scheduledMessages {
        /**
         * Persist a message for later delivery.
         * @param {Object} attrs
         * @param {string} attrs.to
         * @param {string} attrs.body
         * @param {string|Date} attrs.send_at
         * @param {Record<string, unknown>} [attrs.metadata]
         */
        function schedule({ to, body, send_at, metadata }: {
            to: string;
            body: string;
            send_at: string | Date;
            metadata?: Record<string, unknown>;
        }): Promise<any>;
        /** Return one scheduled message, or all of them in delivery order. */
        function get(id: any): Promise<any>;
        /** Cancel a scheduled message, returning it when it existed. */
        function cancel(id: any): Promise<any>;
    }
}
//# sourceMappingURL=api.d.ts.map