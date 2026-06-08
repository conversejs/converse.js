import { api, log } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplFingerprints from './templates/fingerprints.js';

export class Fingerprints extends CustomElement {
    constructor() {
        super();
        this.jid = null;
        this.loading = true;
        this.show_inactive_devices = false;
    }

    static get properties() {
        return {
            jid: { type: String },
            loading: { type: Boolean, state: true },
            show_inactive_devices: { type: Boolean, state: true },
        };
    }

    initialize() {
        this.fetchDeviceLists();
    }

    /**
     * Fetch both the legacy and the omemo:2 device lists in the background so
     * neither blocks rendering; each renders its devices as soon as it resolves.
     * A failure (e.g. on a server without omemo:2 support) must not block the
     * other list. The loading flag is cleared once both have settled so the
     * empty state only shows when there genuinely are no devices.
     */
    fetchDeviceLists() {
        const update = () => this.requestUpdate();
        /** @param {import('@converse/headless').DeviceList} list */
        const listen = (list) => {
            this.listenTo(list.devices, 'change:bundle', update);
            this.listenTo(list.devices, 'change:trusted', update);
            this.listenTo(list.devices, 'remove', update);
            this.listenTo(list.devices, 'add', update);
            this.listenTo(list.devices, 'reset', update);
        };

        const legacy = api.omemo.devicelists
            .get(this.jid, true)
            .then((/** @type {import('@converse/headless').DeviceList} */ list) => {
                this.devicelist = list;
                listen(list);
                this.requestUpdate();
            })
            .catch((e) => log.error(e));

        const v2 = api.omemo.devicelists
            .get(this.jid, true, 'urn:xmpp:omemo:2')
            .then((/** @type {import('@converse/headless').DeviceList} */ v2_list) => {
                this.devicelist_v2 = v2_list;
                listen(v2_list);
                this.requestUpdate();
            })
            .catch((e) => log.error(e));

        Promise.allSettled([legacy, v2]).then(() => {
            this.loading = false;
        });
    }

    /** Returns all devices (legacy + v2) as a flat array for rendering. */
    getAllDevices() {
        const legacy = this.devicelist?.devices?.models ?? [];
        const v2 = this.devicelist_v2?.devices?.models ?? [];
        return [...legacy, ...v2];
    }

    render() {
        return tplFingerprints(this);
    }

    /**
     * @param {Event} ev
     */
    toggleDeviceTrust(ev) {
        const radio = /** @type {HTMLInputElement} */ (ev.target);
        const device_id = radio.getAttribute('name');
        // A physical device publishes the same device id to both the legacy and
        // the omemo:2 device list, but each version has its own identity key
        // (and thus its own trust state). Resolve the device from the collection
        // matching the radio's version, otherwise trust changes on a v2 device
        // would silently be written to the legacy device of the same id.
        const collection =
            radio.dataset.version === 'urn:xmpp:omemo:2' ? this.devicelist_v2?.devices : this.devicelist?.devices;
        const device = collection?.get(device_id);
        device?.save('trusted', parseInt(radio.value, 10));
    }

    /**
     * @param {Event} ev
     */
    toggleShowInactiveDevices(ev) {
        ev.preventDefault();
        this.show_inactive_devices = !this.show_inactive_devices;
    }
}

api.elements.define('converse-omemo-fingerprints', Fingerprints);
