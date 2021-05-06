import { _converse } from '@converse/headless/core';

const UserDetailsModal = {
    events: {
        'click .fingerprint-trust .btn input': 'toggleDeviceTrust'
    },

    initialize () {
        const jid = this.model.get('jid');
        this.devicelist = _converse.devicelists.getDeviceList(jid);
        this.listenTo(this.devicelist.devices, 'change:bundle', this.render);
        this.listenTo(this.devicelist.devices, 'change:trusted', this.render);
        this.listenTo(this.devicelist.devices, 'remove', this.render);
        this.listenTo(this.devicelist.devices, 'add', this.render);
        this.listenTo(this.devicelist.devices, 'reset', this.render);
        return this.__super__.initialize.apply(this, arguments);
    },

    toggleDeviceTrust (ev) {
        const radio = ev.target;
        const device = this.devicelist.devices.get(radio.getAttribute('name'));
        device.save('trusted', parseInt(radio.value, 10));
    }
}

export default UserDetailsModal;
