declare namespace _default {
    namespace omemo {
        /**
         * Returns the device ID of the current device.
         */
        function getDeviceID(): Promise<any>;
        /**
         * Encrypt and send a message to `chat` for every OMEMO version its
         * recipients support, without persisting a Message model. This is the
         * encrypted counterpart of a raw `api.send`.
         *
         * On failure (e.g. no reachable devices, or a presence/server error) a
         * user-facing alert is shown and the error is re-thrown — the same way an
         * encrypted chat-message send fails — so callers can roll back any
         * optimistic state. Awaits the encryption; resolves once the stanza is
         * handed to `api.send`.
         *
         * @method _converse.api.omemo.send
         * @param {import('../../shared/chatbox.js').default} chat
         * @param {string} plaintext - the message body (may be empty)
         * @param {import('strophe.js').Builder[]} [extensions] - encrypted SCE `<content>` children
         */
        function send(chat: import("../../shared/chatbox.js").default, plaintext: string, extensions?: import("strophe.js").Builder[]): Promise<void>;
        namespace session {
            function restore(): Promise<void>;
        }
        namespace devicelists {
            /**
             * Returns the {@link DeviceList} for a particular JID.
             * The device list will be created if it doesn't exist already.
             * @method _converse.api.omemo.devicelists.get
             * @param {String} jid - The Jabber ID for which the device list will be returned.
             * @param {boolean} [create=false] - Set to `true` if the device list
             *      should be created if it cannot be found.
             * @param {import('./types').OMEMOVersion} [version] - The OMEMO version.
             *      Defaults to the legacy version.
             */
            function get(jid: string, create?: boolean, version?: import("./types").OMEMOVersion): Promise<any>;
        }
        namespace bundle {
            /**
             * Lets you generate a new OMEMO device bundle
             *
             * @method _converse.api.omemo.bundle.generate
             * @returns {promise} Promise which resolves once we have a result from the server.
             */
            function generate(): Promise<any>;
        }
    }
}
export default _default;
//# sourceMappingURL=api.d.ts.map