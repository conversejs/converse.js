declare namespace _default {
    namespace omemo {
        /**
         * Returns the device ID of the current device.
         */
        function getDeviceID(): Promise<any>;
        namespace devicelists {
            /**
             * Returns the {@link _converse.DeviceList} for a particular JID.
             * The device list will be created if it doesn't exist already.
             * @method _converse.api.omemo.devicelists.get
             * @param {String} jid - The Jabber ID for which the device list will be returned.
             * @param {boolean} create=false - Set to `true` if the device list
             *      should be created if it cannot be found.
             */
            function get(jid: string, create?: boolean): Promise<any>;
        }
        namespace bundle {
            function generate(): Promise<any>;
        }
    }
}
export default _default;
//# sourceMappingURL=api.d.ts.map