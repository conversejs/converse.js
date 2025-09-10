declare namespace _default {
    namespace vcard {
        /**
         * Enables setting new values for a VCard.
         *
         * Sends out an IQ stanza to set the user's VCard and if
         * successful, it updates the {@link _converse.VCard}
         * for the passed in JID.
         *
         * @method _converse.api.vcard.set
         * @param {string} jid The JID for which the VCard should be set
         * @param {import("./types").VCardData} data A map of VCard keys and values
         * @example
         * let jid = _converse.bare_jid;
         * _converse.api.vcard.set( jid, {
         *     'fn': 'John Doe',
         *     'nickname': 'jdoe'
         * }).then(() => {
         *     // Success
         * }).catch((e) => {
         *     // Failure, e is your error object
         * }).
         */
        function set(jid: string, data: import("./types").VCardData): Promise<any>;
        /**
         * @method _converse.api.vcard.get
         * @param {Model|string} model Either a `Model` instance, or a string JID.
         *     If a `Model` instance is passed in, then it must have either a `jid`
         *     attribute or a `muc_jid` attribute.
         * @param {boolean} [force] A boolean indicating whether the vcard should be
         *     fetched from the server even if it's been fetched before.
         * @returns {Promise<import("./types").VCardResult|null>} A Promise which resolves
         *     with the VCard data for a particular JID or for a `Model` instance which
         *     represents an entity with a JID (such as a roster contact, chat or chatroom occupant).
         *
         * @example
         * const { api } = _converse;
         * api.waitUntil('rosterContactsFetched').then(() => {
         *     api.vcard.get('someone@example.org').then(
         *         (vcard) => {
         *             // Do something with the vcard...
         *         }
         *     );
         * });
         */
        function get(model: Model | string, force?: boolean): Promise<import("./types").VCardResult | null>;
        /**
         * Fetches the VCard associated with a particular `Model` instance
         * (by using its `jid` or `muc_jid` attribute) and then updates the model with the
         * returned VCard data.
         *
         * @method _converse.api.vcard.update
         * @param {Model} model A `Model` instance
         * @param {boolean} [force] A boolean indicating whether the vcard should be
         *     fetched again even if it's been fetched before.
         * @returns {promise} A promise which resolves once the update has completed.
         * @example
         * const { api } = _converse;
         * api.waitUntil('rosterContactsFetched').then(async () => {
         *     const chatbox = await api.chats.get('someone@example.org');
         *     api.vcard.update(chatbox);
         * });
         */
        function update(model: Model, force?: boolean): Promise<any>;
    }
}
export default _default;
export type Model = import("@converse/skeletor").Model;
//# sourceMappingURL=api.d.ts.map