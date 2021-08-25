import debounce from 'lodash-es/debounce';
import log from '@converse/headless/log';
import { __ } from 'i18n';
import { _converse, api, converse } from '@converse/headless/core';

const { Strophe, sizzle, u } = converse.env;


const ProfileModal = {
    events: {
        'change input.select-all': 'selectAll',
        'click .generate-bundle': 'generateOMEMODeviceBundle',
        'submit .fingerprint-removal': 'removeSelectedFingerprints'
    },

    initialize () {
        this.debouncedRender = debounce(this.render, 50);
        this.devicelist = _converse.devicelists.get(_converse.bare_jid);
        this.listenTo(this.devicelist.devices, 'change:bundle', this.debouncedRender);
        this.listenTo(this.devicelist.devices, 'reset', this.debouncedRender);
        this.listenTo(this.devicelist.devices, 'reset', this.debouncedRender);
        this.listenTo(this.devicelist.devices, 'remove', this.debouncedRender);
        this.listenTo(this.devicelist.devices, 'add', this.debouncedRender);
        return this.__super__.initialize.apply(this, arguments);
    },

    beforeRender () {
        const device_id = _converse.omemo_store?.get('device_id');
        if (device_id) {
            this.current_device = this.devicelist.devices.get(device_id);
            this.other_devices = this.devicelist.devices.filter(d => d.get('id') !== device_id);
        }
        return this.__super__.beforeRender?.apply(this, arguments);
    },

    selectAll (ev) {
        let sibling = u.ancestor(ev.target, 'li');
        while (sibling) {
            sibling.querySelector('input[type="checkbox"]').checked = ev.target.checked;
            sibling = sibling.nextElementSibling;
        }
    },

    removeSelectedFingerprints (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.target.querySelector('.select-all').checked = false;
        const device_ids = sizzle('.fingerprint-removal-item input[type="checkbox"]:checked', ev.target).map(
            c => c.value
        );
        this.devicelist
            .removeOwnDevices(device_ids)
            .then(this.modal.hide)
            .catch(err => {
                log.error(err);
                _converse.api.alert(Strophe.LogLevel.ERROR, __('Error'), [
                    __('Sorry, an error occurred while trying to remove the devices.')
                ]);
            });
    },

    generateOMEMODeviceBundle (ev) {
        ev.preventDefault();
        if (confirm(__(
            'Are you sure you want to generate new OMEMO keys? ' +
            'This will remove your old keys and all previously encrypted messages will no longer be decryptable on this device.'
        ))) {
            api.omemo.bundle.generate();
        }
    }
}

export default ProfileModal;
