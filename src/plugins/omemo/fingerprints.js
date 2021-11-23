import tpl_fingerprints from './templates/fingerprints.js';
import { CustomElement } from 'shared/components/element.js';
import { _converse, api } from "@converse/headless/core";

export class Fingerprints extends CustomElement {

    static get properties () {
        return {
            'jid': { type: String }
        }
    }

    async initialize () {
        this.devicelist = await _converse.devicelists.getDeviceList(this.jid);
        this.listenTo(this.devicelist.devices, 'change:bundle', this.requestUpdate);
        this.listenTo(this.devicelist.devices, 'change:trusted', this.requestUpdate);
        this.listenTo(this.devicelist.devices, 'remove', this.requestUpdate);
        this.listenTo(this.devicelist.devices, 'add', this.requestUpdate);
        this.listenTo(this.devicelist.devices, 'reset', this.requestUpdate);
        this.requestUpdate();
    }

    render () {
        return this.devicelist ? tpl_fingerprints(this) : '';
    }

    toggleDeviceTrust (ev) {
        const radio = ev.target;
        const device = this.devicelist.devices.get(radio.getAttribute('name'));
        device.save('trusted', parseInt(radio.value, 10));
    }
}

api.elements.define('converse-omemo-fingerprints', Fingerprints);
