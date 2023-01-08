import { _converse, api } from '@converse/headless/core';
import { generateFingerprint } from './utils.js';

export default {
    /**
     * The "omemo" namespace groups methods relevant to OMEMO
     * encryption.
     *
     * @namespace _converse.api.omemo
     * @memberOf _converse.api
     */
    'omemo': {
        /**
         * Returns the device ID of the current device.
         */
        async getDeviceID () {
            await api.waitUntil('OMEMOInitialized');
            return _converse.omemo_store.get('device_id');
        },

        /**
         * The "devicelists" namespace groups methods related to OMEMO device lists
         *
         * @namespace _converse.api.omemo.devicelists
         * @memberOf _converse.api.omemo
         */
        'devicelists': {
            /**
             * Returns the {@link _converse.DeviceList} for a particular JID.
             * The device list will be created if it doesn't exist already.
             * @method _converse.api.omemo.devicelists.get
             * @param { String } jid - The Jabber ID for which the device list will be returned.
             * @param { bool } create=false - Set to `true` if the device list
             *      should be created if it cannot be found.
             */
            async get (jid, create=false) {
                const list = _converse.devicelists.get(jid) ||
                    (create ? _converse.devicelists.create({ jid }) : null);
                await list?.initialized;
                return list;
            }
        },

        /**
         * The "bundle" namespace groups methods relevant to the user's
         * OMEMO bundle.
         *
         * @namespace _converse.api.omemo.bundle
         * @memberOf _converse.api.omemo
         */
        'bundle': {
            /**
             * Lets you generate a new OMEMO device bundle
             *
             * @method _converse.api.omemo.bundle.generate
             * @returns {promise} Promise which resolves once we have a result from the server.
             */
            'generate': async () => {
                await api.waitUntil('OMEMOInitialized');
                // Remove current device
                const devicelist = await api.omemo.devicelists.get(_converse.bare_jid);

                const device_id = _converse.omemo_store.get('device_id');
                if (device_id) {
                    const device = devicelist.devices.get(device_id);
                    _converse.omemo_store.unset(device_id);
                    if (device) {
                        await new Promise(done => device.destroy({ 'success': done, 'error': done }));
                    }
                    devicelist.devices.trigger('remove');
                }
                // Generate new device bundle and publish
                // https://xmpp.org/extensions/attic/xep-0384-0.3.0.html#usecases-announcing
                await _converse.omemo_store.generateBundle();
                await devicelist.publishDevices();
                const device = devicelist.devices.get(_converse.omemo_store.get('device_id'));
                const fp = generateFingerprint(device);
                await _converse.omemo_store.publishBundle();
                return fp;
            }
        }
    }
}
