import { getOpenPromise } from '@converse/openpromise';
import log from '@converse/log';
import * as errors from '../../shared/errors.js';
import { parsers } from '../../shared/index.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { OMEMOVersionAwareModel } from './profiles.js';

const { Strophe, stx, sizzle, u } = converse.env;

/**
 * @extends {OMEMOVersionAwareModel<import('../../shared/types').JIDModelAttributes>}
 */
class DeviceList extends OMEMOVersionAwareModel {
    /**
     * Whether the most recent server fetch for this device list failed
     * (timeout/error) rather than authoritatively returning no devices.
     * @type {boolean}
     */
    #last_fetch_failed = false;

    get idAttribute() {
        return 'jid';
    }

    async initialize() {
        super.initialize();
        this.initialized = getOpenPromise();
        await this.initDevices();
        this.initialized.resolve();
    }

    initDevices() {
        this.devices = new _converse.exports.Devices(null, { version: this.getVersion() });
        const bare_jid = _converse.session.get('bare_jid');
        const version_suffix = this.isV2() ? '-omemo2' : '';
        const id = `converse.devicelist-${bare_jid}-${this.get('jid')}${version_suffix}`;
        u.initStorage(this.devices, id);
        return this.fetchDevices();
    }

    /**
     * @param {import('./devices').default} collection
     */
    /**
     * Whether the most recent server fetch for this device list failed
     * (timeout or error stanza), as opposed to authoritatively returning no
     * devices (an empty list or item-not-found). Callers use this to decide
     * whether an empty device list is worth re-fetching: a genuine "no devices"
     * answer is not (a PEP push will inform us if that changes, since we
     * advertise `+notify`), but a transient failure is.
     * @returns {boolean}
     */
    get lastFetchFailed() {
        return this.#last_fetch_failed;
    }

    async onDevicesFound(collection) {
        if (collection.length === 0) {
            let ids = [];
            try {
                ids = await this.fetchDevicesFromServer();
                this.#last_fetch_failed = false;
            } catch (e) {
                // We deliberately leave this (empty) device list in place
                // instead of destroying it. `onDevicesFound` runs from within
                // `initialize`, so destroying here would orphan the model
                // mid-initialization (removing it from the collection and
                // storage while `this.initialized` is still pending, and
                // running `publishCurrentDevice` on a destroyed model).
                // Transient failures recover instead via `fetchDevices(true)`
                // in `getDevicesForContact`, and via a fresh server fetch on
                // the next reload.
                if (e === null) {
                    this.#last_fetch_failed = true;
                    log.error(`Timeout error while fetching OMEMO devices for ${this.get('jid')}`);
                } else if (u.isElement(e) && (await parsers.parseErrorStanza(e)) instanceof errors.ItemNotFoundError) {
                    // An authoritative "no such node" — the contact simply has
                    // no device list for this OMEMO version. Not a failure, so
                    // we don't keep retrying on every send.
                    this.#last_fetch_failed = false;
                    log.debug(`No OMEMO devices found for ${this.get('jid')}`);
                } else {
                    this.#last_fetch_failed = true;
                    log.error(`Could not fetch OMEMO devices for ${this.get('jid')}`);
                    log.error(e);
                }
            }
            const bare_jid = _converse.session.get('bare_jid');
            if (this.get('jid') === bare_jid) {
                this.publishCurrentDevice(ids);
            }
        } else {
            this.#last_fetch_failed = false;
        }
    }

    /**
     * @param {boolean} [refresh=false] - Discard any previously memoized
     *      result and fetch the devices anew. Used to recover from a state
     *      where an earlier fetch failed or the contact had not yet published
     *      their device list.
     */
    fetchDevices(refresh = false) {
        if (refresh) {
            this._devices_promise = undefined;
        }
        if (this._devices_promise === undefined) {
            this._devices_promise = new Promise((resolve) => {
                this.devices.fetch({
                    success: (c) => resolve(this.onDevicesFound(c)),
                    error: (_, e) => {
                        log.error(e);
                        resolve();
                    },
                });
            });
        }
        return this._devices_promise;
    }

    /**
     * @returns {Promise<string>}
     */
    async getOwnDeviceId() {
        const { omemo_store } = _converse.state;
        let device_id = omemo_store.get('device_id');
        if (!device_id) {
            // No bundle at all. Generate one (creates device in legacy list)
            await omemo_store.generateBundle();
            device_id = omemo_store.get('device_id');
        }
        if (!this.devices.get(device_id)) {
            // generateBundle always creates the device in the legacy collection.
            // For the v2 list we create a bare entry so publishDevices() includes us.
            const jid = this.get('jid');
            await this.devices.create({ id: device_id, jid }, { promise: true });
        }
        return device_id;
    }

    /**
     * @param {string[]} device_ids
     */
    async publishCurrentDevice(device_ids) {
        const bare_jid = _converse.session.get('bare_jid');
        if (this.get('jid') !== bare_jid) {
            return; // We only publish for ourselves.
        }
        await api.omemo.session.restore();

        if (!_converse.state.omemo_store) {
            // Happens during tests. The connection gets torn down
            // before publishCurrentDevice has time to finish.
            log.debug('publishCurrentDevice: omemo_store is not defined, likely a timing issue');
            return;
        }
        if (!device_ids.includes(await this.getOwnDeviceId())) {
            return this.publishDevices();
        }
    }

    /**
     * @returns {Promise<import('./device').default[]>}
     */
    async fetchDevicesFromServer() {
        const bare_jid = _converse.session.get('bare_jid');
        const node = this.isV2() ? Strophe.NS.OMEMO2_DEVICELIST : Strophe.NS.OMEMO_DEVICELIST;
        const stanza = stx`
            <iq type='get' from='${bare_jid}' to='${this.get('jid')}' xmlns="jabber:client">
                <pubsub xmlns='${Strophe.NS.PUBSUB}'>
                    <items node='${node}'/>
                </pubsub>
            </iq>`;

        const iq = await api.sendIQ(stanza);

        let device_ids;
        if (this.isV2()) {
            const selector = `devices[xmlns="${Strophe.NS.OMEMO2}"] device`;
            device_ids = sizzle(selector, iq).map((d) => d.getAttribute('id'));
        } else {
            const selector = `list[xmlns="${Strophe.NS.OMEMO}"] device`;
            device_ids = sizzle(selector, iq).map((d) => d.getAttribute('id'));
        }

        const jid = this.get('jid');
        return Promise.all(device_ids.map((id) => this.devices.create({ id, jid }, { promise: true })));
    }

    /**
     * Sends an IQ stanza to the current user's "devices" PEP node to
     * ensure that all devices are published for potential chat partners to see.
     * See: https://xmpp.org/extensions/attic/xep-0384-0.3.0.html#usecases-announcing
     */
    publishDevices() {
        const active_devices = this.devices.filter((d) => d.get('active'));
        let item;
        if (this.isV2()) {
            item = stx`
                <item id='current'>
                    <devices xmlns='${Strophe.NS.OMEMO2}'>
                        ${active_devices.map((d) => stx`<device id='${d.get('id')}'/>`)}
                    </devices>
                </item>`;
        } else {
            item = stx`
                <item id='current'>
                    <list xmlns='${Strophe.NS.OMEMO}'>
                        ${active_devices.map((d) => stx`<device id='${d.get('id')}'/>`)}
                    </list>
                </item>`;
        }
        const node = this.isV2() ? Strophe.NS.OMEMO2_DEVICELIST : Strophe.NS.OMEMO_DEVICELIST;
        const options = { access_model: 'open' };
        return api.pubsub.publish(null, node, item, options, false);
    }

    /**
     * @param {string[]} device_ids
     */
    async removeOwnDevices(device_ids) {
        const bare_jid = _converse.session.get('bare_jid');
        if (this.get('jid') !== bare_jid) {
            throw new Error("Cannot remove devices from someone else's device list");
        }
        await Promise.all(
            device_ids
                .map((id) => this.devices.get(id))
                .map(
                    (d) =>
                        new Promise((resolve) =>
                            d.destroy({
                                success: resolve,
                                error: (_, e) => {
                                    log.error(e);
                                    resolve();
                                },
                            }),
                        ),
                ),
        );
        return this.publishDevices();
    }
}

export default DeviceList;
