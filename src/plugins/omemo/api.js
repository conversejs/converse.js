import { _converse, api, u } from "@converse/headless";
import { generateFingerprint } from "./utils.js";
import OMEMOStore from "./store.js";

export default {
    /**
     * The "omemo" namespace groups methods relevant to OMEMO
     * encryption.
     *
     * @namespace _converse.api.omemo
     * @memberOf _converse.api
     */
    omemo: {
        /**
         * Returns the device ID of the current device.
         */
        async getDeviceID() {
            await api.waitUntil("OMEMOInitialized");
            return _converse.state.omemo_store.get("device_id");
        },

        session: {
            async restore() {
                const { state } = _converse;
                if (state.omemo_store === undefined) {
                    const bare_jid = _converse.session.get("bare_jid");
                    const id = `converse.omemosession-${bare_jid}`;
                    state.omemo_store = new OMEMOStore({ id });
                    u.initStorage(state.omemo_store, id);
                }
                await state.omemo_store.fetchSession();
            },
        },

        /**
         * The "devicelists" namespace groups methods related to OMEMO device lists
         *
         * @namespace _converse.api.omemo.devicelists
         * @memberOf _converse.api.omemo
         */
        devicelists: {
            /**
             * Returns the {@link DeviceList} for a particular JID.
             * The device list will be created if it doesn't exist already.
             * @method _converse.api.omemo.devicelists.get
             * @param {String} jid - The Jabber ID for which the device list will be returned.
             * @param {boolean} create=false - Set to `true` if the device list
             *      should be created if it cannot be found.
             */
            async get(jid, create = false) {
                const { devicelists } = _converse.state;
                const list = devicelists.get(jid) || (create ? devicelists.create({ jid }) : null);
                await list?.initialized;
                return list;
            },
        },

        /**
         * The "bundle" namespace groups methods relevant to the user's OMEMO bundle.
         * @namespace _converse.api.omemo.bundle
         * @memberOf _converse.api.omemo
         */
        bundle: {
            /**
             * Lets you generate a new OMEMO device bundle
             *
             * @method _converse.api.omemo.bundle.generate
             * @returns {promise} Promise which resolves once we have a result from the server.
             */
            async generate() {
                await api.waitUntil("OMEMOInitialized");
                // Remove current device
                const bare_jid = _converse.session.get("bare_jid");
                const devicelist = await api.omemo.devicelists.get(bare_jid);

                const { omemo_store } = _converse.state;
                const device_id = omemo_store.get("device_id");
                if (device_id) {
                    const device = devicelist.devices.get(device_id);
                    omemo_store.unset(device_id);
                    if (device) {
                        await new Promise((done) => device.destroy({ "success": done, "error": done }));
                    }
                    devicelist.devices.trigger("remove");
                }
                // Generate new device bundle and publish
                // https://xmpp.org/extensions/attic/xep-0384-0.3.0.html#usecases-announcing
                await omemo_store.generateBundle();
                await devicelist.publishDevices();
                const device = devicelist.devices.get(omemo_store.get("device_id"));
                const fp = generateFingerprint(device);
                await omemo_store.publishBundle();
                return fp;
            },
        },
    },
};
