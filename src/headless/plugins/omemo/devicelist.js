import log from '@converse/headless/log';
import { Model } from '@converse/skeletor/src/model.js';
import { _converse, api, converse } from '@converse/headless/core';
import { getOpenPromise } from '@converse/openpromise';
import { initStorage } from '@converse/headless/utils/storage.js';
import { restoreOMEMOSession } from './utils.js';

const { Strophe, $build, $iq, sizzle } = converse.env;

/**
 * @class
 * @namespace _converse.DeviceList
 * @memberOf _converse
 */
const DeviceList = Model.extend({
    idAttribute: 'jid',

    async initialize () {
        this.initialized = getOpenPromise();
        await this.initDevices();
        this.initialized.resolve();
    },

    initDevices () {
        this.devices = new _converse.Devices();
        const id = `converse.devicelist-${_converse.bare_jid}-${this.get('jid')}`;
        initStorage(this.devices, id);
        return this.fetchDevices();
    },

    async onDevicesFound (collection) {
        if (collection.length === 0) {
            let ids = [];
            try {
                ids = await this.fetchDevicesFromServer();
            } catch (e) {
                if (e === null) {
                    log.error(`Timeout error while fetching devices for ${this.get('jid')}`);
                } else {
                    log.error(`Could not fetch devices for ${this.get('jid')}`);
                    log.error(e);
                }
                this.destroy();
            }
            if (this.get('jid') === _converse.bare_jid) {
                this.publishCurrentDevice(ids);
            }
        }
    },

    fetchDevices () {
        if (this._devices_promise === undefined) {
            this._devices_promise = new Promise(resolve => {
                this.devices.fetch({
                    'success': c => resolve(this.onDevicesFound(c)),
                    'error': (_, e) => {
                        log.error(e);
                        resolve();
                    }
                });
            });
        }
        return this._devices_promise;
    },

    async getOwnDeviceId () {
        let device_id = _converse.omemo_store.get('device_id');
        if (!this.devices.get(device_id)) {
            // Generate a new bundle if we cannot find our device
            await _converse.omemo_store.generateBundle();
            device_id = _converse.omemo_store.get('device_id');
        }
        return device_id;
    },

    async publishCurrentDevice (device_ids) {
        if (this.get('jid') !== _converse.bare_jid) {
            return; // We only publish for ourselves.
        }
        await restoreOMEMOSession();

        if (!_converse.omemo_store) {
            // Happens during tests. The connection gets torn down
            // before publishCurrentDevice has time to finish.
            log.warn('publishCurrentDevice: omemo_store is not defined, likely a timing issue');
            return;
        }
        if (!device_ids.includes(await this.getOwnDeviceId())) {
            return this.publishDevices();
        }
    },

    async fetchDevicesFromServer () {
        const stanza = $iq({
            'type': 'get',
            'from': _converse.bare_jid,
            'to': this.get('jid')
        }).c('pubsub', { 'xmlns': Strophe.NS.PUBSUB })
          .c('items', { 'node': Strophe.NS.OMEMO_DEVICELIST });

        const iq = await api.sendIQ(stanza);
        const selector = `list[xmlns="${Strophe.NS.OMEMO}"] device`;
        const device_ids = sizzle(selector, iq).map(d => d.getAttribute('id'));
        const jid = this.get('jid');
        return Promise.all(device_ids.map(id => this.devices.create({ id, jid }, { 'promise': true })));
    },

    /**
     * Send an IQ stanza to the current user's "devices" PEP node to
     * ensure that all devices are published for potential chat partners to see.
     * See: https://xmpp.org/extensions/xep-0384.html#usecases-announcing
     */
    publishDevices () {
        const item = $build('item', { 'id': 'current' }).c('list', { 'xmlns': Strophe.NS.OMEMO });
        this.devices.filter(d => d.get('active')).forEach(d => item.c('device', { 'id': d.get('id') }).up());
        const options = { 'pubsub#access_model': 'open' };
        return api.pubsub.publish(null, Strophe.NS.OMEMO_DEVICELIST, item, options, false);
    },

    async removeOwnDevices (device_ids) {
        if (this.get('jid') !== _converse.bare_jid) {
            throw new Error("Cannot remove devices from someone else's device list");
        }
        await Promise.all(device_ids.map(id => this.devices.get(id)).map(d =>
            new Promise(resolve => d.destroy({
                'success': resolve,
                'error': (_, e) => { log.error(e); resolve(); }
            }))
        ));
        return this.publishDevices();
    }
});

export default DeviceList;
