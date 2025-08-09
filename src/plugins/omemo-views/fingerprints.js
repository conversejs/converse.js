import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplFingerprints from './templates/fingerprints.js';

export class Fingerprints extends CustomElement {
    constructor() {
        super();
        this.jid = null;
        this.show_inactive_devices = false;
    }

    static get properties() {
        return {
            jid: { type: String },
            show_inactive_devices: { type: Boolean, state: true }
        };
    }

    async initialize() {
        this.devicelist = await api.omemo.devicelists.get(this.jid, true);
        this.listenTo(this.devicelist.devices, 'change:bundle', () => this.requestUpdate());
        this.listenTo(this.devicelist.devices, 'change:trusted', () => this.requestUpdate());
        this.listenTo(this.devicelist.devices, 'remove', () => this.requestUpdate());
        this.listenTo(this.devicelist.devices, 'add', () => this.requestUpdate());
        this.listenTo(this.devicelist.devices, 'reset', () => this.requestUpdate());
        this.requestUpdate();
    }

    render() {
        return this.devicelist ? tplFingerprints(this) : '';
    }

    /**
     * @param {Event} ev
     */
    toggleDeviceTrust(ev) {
        const radio = /** @type {HTMLInputElement} */ (ev.target);
        const device = this.devicelist.devices.get(radio.getAttribute('name'));
        device.save('trusted', parseInt(radio.value, 10));
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
