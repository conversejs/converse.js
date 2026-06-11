import tplProfile from './templates/profile.js';
import tplSpinner from 'templates/spinner.js';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { _converse, api, converse, log } from '@converse/headless';

const { Strophe, sizzle, u } = converse.env;

export class Profile extends CustomElement {
    async initialize() {
        await this.setAttributes();
        for (const list of [this.devicelist, this.devicelist_v2]) {
            const update = () => this.requestUpdate();
            this.listenTo(list.devices, 'change:bundle', update);
            this.listenTo(list.devices, 'reset', update);
            this.listenTo(list.devices, 'remove', update);
            this.listenTo(list.devices, 'add', update);
        }
        this.requestUpdate();
    }

    async setAttributes() {
        const bare_jid = _converse.session.get('bare_jid');

        const [devicelist, devicelist_v2, device_id] = await Promise.all([
            api.omemo.devicelists.get(bare_jid, true, Strophe.NS.OMEMO),
            api.omemo.devicelists.get(bare_jid, true, Strophe.NS.OMEMO2),
            api.omemo.getDeviceID(),
        ]);

        this.devicelist = devicelist;
        this.devicelist_v2 = devicelist_v2;
        this.device_id = device_id;
        this.current_device = this.devicelist.devices.get(this.device_id);
        this.current_device_v2 = this.devicelist_v2.devices.get(this.device_id);
        this.other_devices = this.devicelist.devices.filter((d) => d.get('id') !== this.device_id);
    }

    render() {
        return this.devicelist ? tplProfile(this) : tplSpinner();
    }

    /** @param {MouseEvent} ev */
    async copyFingerprint(ev) {
        ev.preventDefault();
        const button = /** @type {HTMLButtonElement} */ (ev.currentTarget);
        await navigator.clipboard.writeText(button.dataset.fingerprint);
        // Briefly swap the icon to a checkmark for feedback.
        const icon = button.querySelector('converse-icon');
        icon?.classList.replace('fa-copy', 'fa-check');
        setTimeout(() => icon?.classList.replace('fa-check', 'fa-copy'), 1500);
    }

    selectAll(ev) {
        // eslint-disable-line class-methods-use-this
        let sibling = u.ancestor(ev.target, 'li');
        while (sibling) {
            sibling.querySelector('input[type="checkbox"]').checked = ev.target.checked;
            sibling = sibling.nextElementSibling;
        }
    }

    async removeSelectedFingerprints(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.target.querySelector('.select-all').checked = false;
        const device_ids = sizzle('.fingerprint-removal-item input[type="checkbox"]:checked', ev.target).map(
            (c) => c.value,
        );

        try {
            await this.devicelist.removeOwnDevices(device_ids);
        } catch (err) {
            log.error(err);
            _converse.api.alert(Strophe.LogLevel.ERROR, __('Error'), [
                __('Sorry, an error occurred while trying to remove the devices.'),
            ]);
        }
        await this.setAttributes();
        this.requestUpdate();
    }

    async generateOMEMODeviceBundle(ev) {
        ev.preventDefault();

        const result = await api.confirm(
            __('Confirm'),
            __(
                'Are you sure you want to generate new OMEMO keys? ' +
                    'This will remove your old keys and all previously ' +
                    'encrypted messages will no longer be decryptable on this device.',
            ),
        );

        if (result) {
            await api.omemo.bundle.generate();
            await this.setAttributes();
            this.requestUpdate();
        }
    }
}

api.elements.define('converse-omemo-profile', Profile);
