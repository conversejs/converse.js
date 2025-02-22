declare namespace _default {
    namespace archive {
        /**
         * Query for archived messages.
         *
         * The options parameter can also be an instance of
         * RSM to enable easy querying between results pages.
         *
         * @method _converse.api.archive.query
         * @param {import('./types').ArchiveQueryOptions} [options={}] - Optional query parameters
         * @throws {Error} An error is thrown if the XMPP server responds with an error.
         * @returns {Promise<import('./types').MAMQueryResult>}
         *
         * @example
         * // Requesting all archived messages
         * // ================================
         * //
         * // The simplest query that can be made is to simply not pass in any parameters.
         * // Such a query will return all archived messages for the current user.
         *
         * let result;
         * try {
         *     result = await api.archive.query();
         * } catch (e) {
         *     // The query was not successful, perhaps inform the user?
         *     // The IQ stanza returned by the XMPP server is passed in, so that you
         *     // may inspect it and determine what the problem was.
         * }
         * // Do something with the messages, like showing them in your webpage.
         * result.messages.forEach(m => this.showMessage(m));
         *
         * @example
         * // Requesting all archived messages for a particular contact or room
         * // =================================================================
         * //
         * // To query for messages sent between the current user and another user or room,
         * // the query options need to contain the the JID (Jabber ID) of the user or
         * // room under the  `with` key.
         *
         * // For a particular user
         * let result;
         * try {
         *    result = await api.archive.query({ mam: { with: 'john@doe.net' }});
         * } catch (e) {
         *     // The query was not successful
         * }
         *
         * // For a particular room
         * let result;
         * try {
         *    result = await api.archive.query({ mam: { with: 'discuss@conference.doglovers.net' }}, is_groupchat: true });
         * } catch (e) {
         *     // The query was not successful
         * }
         *
         * @example
         * // Requesting all archived messages before or after a certain date
         * // ===============================================================
         * //
         * // The MAM `start` and `end` parameters are used to query for messages
         * // within a certain timeframe. The passed in date values may either be ISO8601
         * // formatted date strings, or JavaScript Date objects.
         *
         *  const options = {
         *      mam: {
         *          'with': 'john@doe.net',
         *          'start': '2010-06-07T00:00:00Z',
         *          'end': '2010-07-07T13:23:54Z'
         *      },
         *  };
         * let result;
         * try {
         *    result = await api.archive.query(options);
         * } catch (e) {
         *     // The query was not successful
         * }
         *
         * @example
         * // Limiting the amount of messages returned
         * // ========================================
         * //
         * // The amount of returned messages may be limited with the `max` parameter.
         * // By default, the messages are returned from oldest to newest.
         *
         * // Return maximum 10 archived messages
         * let result;
         * try {
         *     result = await api.archive.query({ mam: { with: 'john@doe.net', max:10 }});
         * } catch (e) {
         *     // The query was not successful
         * }
         *
         * @example
         * // Paging forwards through a set of archived messages
         * // ==================================================
         * //
         * // When limiting the amount of messages returned per query, you might want to
         * // repeatedly make a further query to fetch the next batch of messages.
         * //
         * // To simplify this usecase for you, the callback method receives not only an array
         * // with the returned archived messages, but also a special RSM (*Result Set Management*)
         * // object which contains the query parameters you passed in, as well
         * // as two utility methods `next`, and `previous`.
         * //
         * // When you call one of these utility methods on the returned RSM object, and then
         * // pass the result into a new query, you'll receive the next or previous batch of
         * // archived messages. Please note, when calling these methods, pass in an integer
         * // to limit your results.
         *
         * const options = { mam: { with: 'john@doe.net' }, rsm: { max:10 }};
         * let result;
         * try {
         *     result = await api.archive.query(options);
         * } catch (e) {
         *     // The query was not successful
         * }
         * // Do something with the messages, like showing them in your webpage.
         * result.messages.forEach(m => this.showMessage(m));
         *
         * while (!result.complete) {
         *     try {
         *         result = await api.archive.query({
         *             mam: { ...options.mam },
         *             rsm: {
         *                 ...options.rsm,
         *                 ...rsm.next(10).query
         *                 }
         *             });
         *     } catch (e) {
         *         // The query was not successful
         *     }
         *     // Do something with the messages, like showing them in your webpage.
         *     result.messages.forEach(m => this.showMessage(m));
         * }
         *
         * @example
         * // Paging backwards through a set of archived messages
         * // ===================================================
         * //
         * // To page backwards through the archive, you need to know the UID of the message
         * // which you'd like to page backwards from and then pass that as value for the
         * // `before` parameter. If you simply want to page backwards from the most recent
         * // message, pass in the `before` parameter with an empty string value `''`.
         *
         * let result;
         * const options = { rsm: { before: '', max:5 }};
         * try {
         *     result = await api.archive.query(options);
         * } catch (e) {
         *     // The query was not successful
         * }
         * // Do something with the messages, like showing them in your webpage.
         * result.messages.forEach(m => this.showMessage(m));
         *
         * // Now we query again, to get the previous batch.
         * try {
         *     try {
         *         result = await api.archive.query({
         *             mam: { ...options.mam },
         *             rsm: {
         *                 ...options.rsm,
         *                 ...rsm.previous(5).query
         *                 }
         *             });
         * } catch (e) {
         *     // The query was not successful
         * }
         * // Do something with the messages, like showing them in your webpage.
         * result.messages.forEach(m => this.showMessage(m));
         *
         */
        function query(options?: import("./types").ArchiveQueryOptions): Promise<import("./types").MAMQueryResult>;
    }
}
export default _default;
//# sourceMappingURL=api.d.ts.map