import log from '@converse/headless/log';
import tpl_profile from './templates/profile.js';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";

const { Strophe, sizzle, u } = converse.env;


export class Profile extends CustomElement {

    async initialize () {
        this.devicelist = await api.omemo.devicelists.get(_converse.bare_jid, true);
        await this.setAttributes();
        this.listenTo(this.devicelist.devices, 'change:bundle', () => this.requestUpdate());
        this.listenTo(this.devicelist.devices, 'reset', () => this.requestUpdate());
        this.listenTo(this.devicelist.devices, 'reset', () => this.requestUpdate());
        this.listenTo(this.devicelist.devices, 'remove', () => this.requestUpdate());
        this.listenTo(this.devicelist.devices, 'add', () => this.requestUpdate());
        this.requestUpdate();
    }

    async setAttributes () {
        this.device_id = await api.omemo.getDeviceID();
        this.current_device = this.devicelist.devices.get(this.device_id);
        this.other_devices = this.devicelist.devices.filter(d => d.get('id') !== this.device_id);
    }

    render () {
        return this.devicelist ? tpl_profile(this) : '';
    }

    selectAll (ev) {  // eslint-disable-line class-methods-use-this
        let sibling = u.ancestor(ev.target, 'li');
        while (sibling) {
            sibling.querySelector('input[type="checkbox"]').checked = ev.target.checked;
            sibling = sibling.nextElementSibling;
        }
    }

    async removeSelectedFingerprints (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.target.querySelector('.select-all').checked = false;
        const device_ids = sizzle('.fingerprint-removal-item input[type="checkbox"]:checked', ev.target).map(
            c => c.value
        );

        try {
            await this.devicelist.removeOwnDevices(device_ids);
        } catch (err) {
            log.error(err);
            _converse.api.alert(Strophe.LogLevel.ERROR, __('Error'), [
                __('Sorry, an error occurred while trying to remove the devices.')
            ]);
        }
        await this.setAttributes();
        this.requestUpdate();
    }

    async generateOMEMODeviceBundle (ev) {
        ev.preventDefault();

        const result = await api.confirm(__(
            'Are you sure you want to generate new OMEMO keys? ' +
            'This will remove your old keys and all previously ' +
            'encrypted messages will no longer be decryptable on this device.'));

        if (result) {
            await api.omemo.bundle.generate();
            await this.setAttributes();
            this.requestUpdate();
        }
    }
}

api.elements.define('converse-omemo-profile', Profile);
