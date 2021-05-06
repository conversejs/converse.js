import concat from 'lodash-es/concat';
import { UNTRUSTED } from '../consts.js';
import { __ } from 'i18n';
import { _converse, converse } from '@converse/headless/core';
import {
    addKeysToMessageStanza,
    generateFingerprint,
    getDevicesForContact,
    getSession,
    omemo,
} from '../utils.js';

const { Strophe, $msg } = converse.env;

const ConverseMixins = {

    generateFingerprints: async function (jid) {
        const devices = await getDevicesForContact(jid);
        return Promise.all(devices.map(d => generateFingerprint(d)));
    },

    getDeviceForContact: function (jid, device_id) {
        return getDevicesForContact(jid).then(devices => devices.get(device_id));
    },

    contactHasOMEMOSupport: async function (jid) {
        /* Checks whether the contact advertises any OMEMO-compatible devices. */
        const devices = await getDevicesForContact(jid);
        return devices.length > 0;
    },

    getBundlesAndBuildSessions: async function (chatbox) {
        const no_devices_err = __('Sorry, no devices found to which we can send an OMEMO encrypted message.');
        let devices;
        if (chatbox.get('type') === _converse.CHATROOMS_TYPE) {
            const collections = await Promise.all(chatbox.occupants.map(o => getDevicesForContact(o.get('jid'))));
            devices = collections.reduce((a, b) => concat(a, b.models), []);
        } else if (chatbox.get('type') === _converse.PRIVATE_CHAT_TYPE) {
            const their_devices = await getDevicesForContact(chatbox.get('jid'));
            if (their_devices.length === 0) {
                const err = new Error(no_devices_err);
                err.user_facing = true;
                throw err;
            }
            const own_devices = _converse.devicelists.get(_converse.bare_jid).devices;
            devices = [...own_devices.models, ...their_devices.models];
        }
        // Filter out our own device
        const id = _converse.omemo_store.get('device_id');
        devices = devices.filter(d => d.get('id') !== id);
        // Fetch bundles if necessary
        await Promise.all(devices.map(d => d.getBundle()));

        const sessions = devices.filter(d => d).map(d => getSession(d));
        await Promise.all(sessions);
        if (sessions.includes(null)) {
            // We couldn't build a session for certain devices.
            devices = devices.filter(d => sessions[devices.indexOf(d)]);
            if (devices.length === 0) {
                const err = new Error(no_devices_err);
                err.user_facing = true;
                throw err;
            }
        }
        return devices;
    },

    createOMEMOMessageStanza: function (chatbox, message, devices) {
        const body = __(
            'This is an OMEMO encrypted message which your client doesn’t seem to support. ' +
                'Find more information on https://conversations.im/omemo'
        );

        if (!message.get('message')) {
            throw new Error('No message body to encrypt!');
        }
        const stanza = $msg({
            'from': _converse.connection.jid,
            'to': chatbox.get('jid'),
            'type': chatbox.get('message_type'),
            'id': message.get('msgid')
        }).c('body').t(body).up();

        if (message.get('type') === 'chat') {
            stanza.c('request', { 'xmlns': Strophe.NS.RECEIPTS }).up();
        }
        // An encrypted header is added to the message for
        // each device that is supposed to receive it.
        // These headers simply contain the key that the
        // payload message is encrypted with,
        // and they are separately encrypted using the
        // session corresponding to the counterpart device.
        stanza
            .c('encrypted', { 'xmlns': Strophe.NS.OMEMO })
            .c('header', { 'sid': _converse.omemo_store.get('device_id') });

        return omemo.encryptMessage(message.get('message')).then(obj => {
            // The 16 bytes key and the GCM authentication tag (The tag
            // SHOULD have at least 128 bit) are concatenated and for each
            // intended recipient device, i.e. both own devices as well as
            // devices associated with the contact, the result of this
            // concatenation is encrypted using the corresponding
            // long-standing SignalProtocol session.
            const promises = devices
                .filter(device => device.get('trusted') != UNTRUSTED && device.get('active'))
                .map(device => chatbox.encryptKey(obj.key_and_tag, device));

            return Promise.all(promises)
                .then(dicts => addKeysToMessageStanza(stanza, dicts, obj.iv))
                .then(stanza => {
                    stanza.c('payload').t(obj.payload).up().up();
                    stanza.c('store', { 'xmlns': Strophe.NS.HINTS });
                    return stanza;
                });
        });
    }
}

export default ConverseMixins;
