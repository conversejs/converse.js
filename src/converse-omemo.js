// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

/* global libsignal, ArrayBuffer */
/**
 * @module converse-omemo
 */
import "converse-profile";
import BrowserStorage from "backbone.browserStorage";
import converse from "@converse/headless/converse-core";
import tpl_toolbar_omemo from "templates/toolbar_omemo.html";

const { Backbone, Strophe, sizzle, $build, $iq, $msg, _ } = converse.env;
const u = converse.env.utils;

Strophe.addNamespace('OMEMO_DEVICELIST', Strophe.NS.OMEMO+".devicelist");
Strophe.addNamespace('OMEMO_VERIFICATION', Strophe.NS.OMEMO+".verification");
Strophe.addNamespace('OMEMO_WHITELISTED', Strophe.NS.OMEMO+".whitelisted");
Strophe.addNamespace('OMEMO_BUNDLES', Strophe.NS.OMEMO+".bundles");

const UNDECIDED = 0;
const TRUSTED = 1; // eslint-disable-line no-unused-vars
const UNTRUSTED = -1;
const TAG_LENGTH = 128;
const KEY_ALGO = {
    'name': "AES-GCM",
    'length': 128
};


class IQError extends Error {
    constructor (message, iq) {
        super(message, iq);
        this.name = 'IQError';
        this.iq = iq;
    }
}


function parseBundle (bundle_el) {
    /* Given an XML element representing a user's OMEMO bundle, parse it
     * and return a map.
     */
    const signed_prekey_public_el = bundle_el.querySelector('signedPreKeyPublic');
    const signed_prekey_signature_el = bundle_el.querySelector('signedPreKeySignature');
    const prekeys = sizzle(`prekeys > preKeyPublic`, bundle_el)
        .map(el => ({
            'id': parseInt(el.getAttribute('preKeyId'), 10),
            'key': el.textContent
        }));
    return {
        'identity_key': bundle_el.querySelector('identityKey').textContent.trim(),
        'signed_prekey': {
            'id': parseInt(signed_prekey_public_el.getAttribute('signedPreKeyId'), 10),
            'public_key': signed_prekey_public_el.textContent,
            'signature': signed_prekey_signature_el.textContent
        },
        'prekeys': prekeys
    }
}


converse.plugins.add('converse-omemo', {

    enabled (_converse) {
        return window.libsignal && !_converse.blacklisted_plugins.includes('converse-omemo') && _converse.config.get('trusted');
    },

    dependencies: ["converse-chatview", "converse-pubsub", "converse-profile"],

    overrides: {

        ProfileModal: {
            events: {
                'change input.select-all': 'selectAll',
                'click .generate-bundle': 'generateOMEMODeviceBundle',
                'submit .fingerprint-removal': 'removeSelectedFingerprints'
            },

            initialize () {
                const { _converse } = this.__super__;
                this.debouncedRender = _.debounce(this.render, 50);
                this.devicelist = _converse.devicelists.get(_converse.bare_jid);
                this.listenTo(this.devicelist.devices, 'change:bundle', this.debouncedRender);
                this.listenTo(this.devicelist.devices, 'reset', this.debouncedRender);
                this.listenTo(this.devicelist.devices, 'reset', this.debouncedRender);
                this.listenTo(this.devicelist.devices, 'remove', this.debouncedRender);
                this.listenTo(this.devicelist.devices, 'add', this.debouncedRender);
                return this.__super__.initialize.apply(this, arguments);
            },

            beforeRender () {
                const { _converse } = this.__super__,
                      device_id = _converse.omemo_store.get('device_id');

                if (device_id) {
                    this.current_device = this.devicelist.devices.get(device_id);
                }
                this.other_devices = this.devicelist.devices.filter(d => (d.get('id') !== device_id));
                if (this.__super__.beforeRender) {
                    return this.__super__.beforeRender.apply(this, arguments);
                }
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
                ev.target.querySelector('.select-all').checked = false
                const device_ids = sizzle('.fingerprint-removal-item input[type="checkbox"]:checked', ev.target).map(c => c.value);
                this.devicelist.removeOwnDevices(device_ids)
                    .then(this.modal.hide)
                    .catch(err => {
                        const { _converse } = this.__super__,
                              { __ } = _converse;
                        _converse.log(err, Strophe.LogLevel.ERROR);
                        _converse.api.alert.show(
                            Strophe.LogLevel.ERROR,
                            __('Error'), [__('Sorry, an error occurred while trying to remove the devices.')]
                        )
                    });
            },

            generateOMEMODeviceBundle (ev) {
                const { _converse } = this.__super__,
                      { __, api } = _converse;
                ev.preventDefault();
                if (confirm(__(
                    "Are you sure you want to generate new OMEMO keys? " +
                    "This will remove your old keys and all previously encrypted messages will no longer be decryptable on this device.")
                )) {
                    api.omemo.bundle.generate();
                }
            }
        },

        UserDetailsModal: {
            events: {
                'click .fingerprint-trust .btn input': 'toggleDeviceTrust'
            },

            initialize () {
                const { _converse } = this.__super__;
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
        },

        ChatBox: {
            async getMessageAttributesFromStanza (stanza, original_stanza) {
                const { _converse } = this.__super__;
                const encrypted = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO}"]`, original_stanza).pop(),
                      attrs = await this.__super__.getMessageAttributesFromStanza.apply(this, arguments);

                if (!encrypted || !_converse.config.get('trusted')) {
                    return attrs;
                } else {
                    return this.getEncryptionAttributesfromStanza(stanza, original_stanza, attrs);
                }
            },

            async sendMessage (text, spoiler_hint) {
                if (this.get('omemo_active') && text) {
                    const { _converse } = this.__super__;
                    const attrs = this.getOutgoingMessageAttributes(text, spoiler_hint);
                    attrs['is_encrypted'] = true;
                    attrs['plaintext'] = attrs.message;
                    let message, stanza;
                    try {
                        const devices = await _converse.getBundlesAndBuildSessions(this);
                        message = this.messages.create(attrs);
                        stanza = await _converse.createOMEMOMessageStanza(this, message, devices);
                    } catch (e) {
                        this.handleMessageSendError(e);
                        return null;
                    }
                    _converse.api.send(stanza);
                    return message;
                } else {
                    return this.__super__.sendMessage.apply(this, arguments);
                }
            }
        },

        ChatBoxView:  {
            events: {
                'click .toggle-omemo': 'toggleOMEMO'
            },

            initialize () {
                this.__super__.initialize.apply(this, arguments);
                this.listenTo(this.model, 'change:omemo_active', this.renderOMEMOToolbarButton);
                this.listenTo(this.model, 'change:omemo_supported', this.onOMEMOSupportedDetermined);
            },

            showMessage (message) {
                // We don't show a message if it's only keying material
                if (!message.get('is_only_key')) {
                    return this.__super__.showMessage.apply(this, arguments);
                }
            }
        },

        ChatRoomView: {
            events: {
                'click .toggle-omemo': 'toggleOMEMO'
            },

            initialize () {
                this.__super__.initialize.apply(this, arguments);
                this.listenTo(this.model, 'change:omemo_active', this.renderOMEMOToolbarButton);
                this.listenTo(this.model, 'change:omemo_supported', this.onOMEMOSupportedDetermined);
            }
        }
    },

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by Converse.js's plugin machinery.
         */
        const { _converse } = this,
              { __ } = _converse;

        _converse.api.settings.update({
            'omemo_default': false,
        });

        _converse.api.promises.add(['OMEMOInitialized']);

        _converse.NUM_PREKEYS = 100; // Set here so that tests can override


        /**
         * Mixin object that contains OMEMO-related methods for
         * {@link _converse.ChatBox} or {@link _converse.ChatRoom} objects.
         *
         * @typedef {Object} OMEMOEnabledChatBox
         */
        const OMEMOEnabledChatBox = {

            async encryptMessage (plaintext) {
                // The client MUST use fresh, randomly generated key/IV pairs
                // with AES-128 in Galois/Counter Mode (GCM).

                // For GCM a 12 byte IV is strongly suggested as other IV lengths
                // will require additional calculations. In principle any IV size
                // can be used as long as the IV doesn't ever repeat. NIST however
                // suggests that only an IV size of 12 bytes needs to be supported
                // by implementations.
                //
                // https://crypto.stackexchange.com/questions/26783/ciphertext-and-tag-size-and-iv-transmission-with-aes-in-gcm-mode

                const iv = crypto.getRandomValues(new window.Uint8Array(12)),
                      key = await crypto.subtle.generateKey(KEY_ALGO, true, ["encrypt", "decrypt"]),
                      algo = {
                          'name': 'AES-GCM',
                          'iv': iv,
                          'tagLength': TAG_LENGTH
                      },
                      encrypted = await crypto.subtle.encrypt(algo, key, u.stringToArrayBuffer(plaintext)),
                      length = encrypted.byteLength - ((128 + 7) >> 3),
                      ciphertext = encrypted.slice(0, length),
                      tag = encrypted.slice(length),
                      exported_key = await crypto.subtle.exportKey("raw", key);

                return Promise.resolve({
                    'key': exported_key,
                    'tag': tag,
                    'key_and_tag': u.appendArrayBuffer(exported_key, tag),
                    'payload': u.arrayBufferToBase64(ciphertext),
                    'iv': u.arrayBufferToBase64(iv)
                });
            },

            async decryptMessage (obj) {
                const key_obj = await crypto.subtle.importKey('raw', obj.key, KEY_ALGO, true, ['encrypt','decrypt']),
                      cipher = u.appendArrayBuffer(u.base64ToArrayBuffer(obj.payload), obj.tag),
                      algo = {
                          'name': "AES-GCM",
                          'iv': u.base64ToArrayBuffer(obj.iv),
                          'tagLength': TAG_LENGTH
                      }
                return u.arrayBufferToString(await crypto.subtle.decrypt(algo, key_obj, cipher));
            },

            reportDecryptionError (e) {
                if (_converse.debug) {
                    const { __ } = _converse;
                    this.messages.create({
                        'message': __("Sorry, could not decrypt a received OMEMO message due to an error.") + ` ${e.name} ${e.message}`,
                        'type': 'error',
                    });
                }
                _converse.log(`${e.name} ${e.message}`, Strophe.LogLevel.ERROR);
            },

            async handleDecryptedWhisperMessage (attrs, key_and_tag) {
                const encrypted = attrs.encrypted,
                      devicelist = _converse.devicelists.getDeviceList(this.get('jid'));

                this.save('omemo_supported', true);
                let device = devicelist.get(encrypted.device_id);
                if (!device) {
                    device = devicelist.devices.create({'id': encrypted.device_id, 'jid': attrs.from});
                }
                if (encrypted.payload) {
                    const key = key_and_tag.slice(0, 16),
                          tag = key_and_tag.slice(16);
                    const result = await this.decryptMessage(Object.assign(encrypted, {'key': key, 'tag': tag}));
                    device.save('active', true);
                    return result;
                }
            },

            decrypt (attrs) {
                const session_cipher = this.getSessionCipher(attrs.from, parseInt(attrs.encrypted.device_id, 10));

                // https://xmpp.org/extensions/xep-0384.html#usecases-receiving
                if (attrs.encrypted.prekey === true) {
                    let plaintext;
                    return session_cipher.decryptPreKeyWhisperMessage(u.base64ToArrayBuffer(attrs.encrypted.key), 'binary')
                        .then(key_and_tag => this.handleDecryptedWhisperMessage(attrs, key_and_tag))
                        .then(pt => {
                            plaintext = pt;
                            return _converse.omemo_store.generateMissingPreKeys();
                        }).then(() => _converse.omemo_store.publishBundle())
                          .then(() => {
                            if (plaintext) {
                                return Object.assign(attrs, {'plaintext': plaintext});
                            } else {
                                return Object.assign(attrs, {'is_only_key': true});
                            }
                        }).catch(e => {
                            this.reportDecryptionError(e);
                            return attrs;
                        });
                } else {
                    return session_cipher.decryptWhisperMessage(u.base64ToArrayBuffer(attrs.encrypted.key), 'binary')
                        .then(key_and_tag => this.handleDecryptedWhisperMessage(attrs, key_and_tag))
                        .then(plaintext => Object.assign(attrs, {'plaintext': plaintext}))
                        .catch(e => {
                            this.reportDecryptionError(e);
                            return attrs;
                        });
                }
            },

            getEncryptionAttributesfromStanza (stanza, original_stanza, attrs) {
                const encrypted = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO}"]`, original_stanza).pop(),
                      header = encrypted.querySelector('header'),
                      key = sizzle(`key[rid="${_converse.omemo_store.get('device_id')}"]`, encrypted).pop();
                if (key) {
                    attrs['is_encrypted'] = true;
                    attrs['encrypted'] = {
                        'device_id': header.getAttribute('sid'),
                        'iv': header.querySelector('iv').textContent,
                        'key': key.textContent,
                        'payload': _.get(encrypted.querySelector('payload'), 'textContent', null),
                        'prekey': _.includes(['true', '1'], key.getAttribute('prekey'))
                    }
                    return this.decrypt(attrs);
                } else {
                    return Promise.resolve(attrs);
                }
            },

            getSessionCipher (jid, id) {
                const address = new libsignal.SignalProtocolAddress(jid, id);
                this.session_cipher = new window.libsignal.SessionCipher(_converse.omemo_store, address);
                return this.session_cipher;
            },

            encryptKey (plaintext, device) {
                return this.getSessionCipher(device.get('jid'), device.get('id'))
                    .encrypt(plaintext)
                    .then(payload => ({'payload': payload, 'device': device}));
            },

            handleMessageSendError (e) {
                if (e.name === 'IQError') {
                    this.save('omemo_supported', false);

                    const err_msgs = [];
                    if (sizzle(`presence-subscription-required[xmlns="${Strophe.NS.PUBSUB_ERROR}"]`, e.iq).length) {
                        err_msgs.push(__("Sorry, we're unable to send an encrypted message because %1$s "+
                                        "requires you to be subscribed to their presence in order to see their OMEMO information",
                                        e.iq.getAttribute('from')));
                    } else if (sizzle(`remote-server-not-found[xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"]`, e.iq).length) {
                        err_msgs.push(__("Sorry, we're unable to send an encrypted message because the remote server for %1$s could not be found",
                                        e.iq.getAttribute('from')));
                    } else {
                        err_msgs.push(__("Unable to send an encrypted message due to an unexpected error."));
                        err_msgs.push(e.iq.outerHTML);
                    }
                    _converse.api.alert.show(Strophe.LogLevel.ERROR, __('Error'), err_msgs);
                    _converse.log(e, Strophe.LogLevel.ERROR);
                } else if (e.user_facing) {
                    _converse.api.alert.show(Strophe.LogLevel.ERROR, __('Error'), [e.message]);
                    _converse.log(e, Strophe.LogLevel.ERROR);
                } else {
                    throw e;
                }
            }
        }
        Object.assign(_converse.ChatBox.prototype, OMEMOEnabledChatBox);


        const OMEMOEnabledChatView = {

            onOMEMOSupportedDetermined () {
                if (!this.model.get('omemo_supported') && this.model.get('omemo_active')) {
                    this.model.set('omemo_active', false); // Will cause render
                } else {
                    this.renderOMEMOToolbarButton();
                }
            },

            renderOMEMOToolbarButton () {
                if (this.model.get('type') !== _converse.CHATROOMS_TYPE ||
                        this.model.features.get('membersonly') &&
                        this.model.features.get('nonanonymous')) {

                    const icon = this.el.querySelector('.toggle-omemo');
                    const html = tpl_toolbar_omemo(Object.assign(this.model.toJSON(), {'__': __}));
                    if (icon) {
                        icon.outerHTML = html;
                    } else {
                        this.el.querySelector('.chat-toolbar').insertAdjacentHTML('beforeend', html);
                    }
                } else {
                    const icon = this.el.querySelector('.toggle-omemo');
                    if (icon) {
                        icon.parentElement.removeChild(icon);
                    }
                }
            },

            toggleOMEMO (ev) {
                if (!this.model.get('omemo_supported')) {
                    let messages;
                    if (this.model.get('type') === _converse.CHATROOMS_TYPE) {
                        messages = [__(
                            'Cannot use end-to-end encryption in this groupchat, '+
                            'either the groupchat has some anonymity or not all participants support OMEMO.'
                        )];
                    } else {
                        messages = [__(
                            "Cannot use end-to-end encryption because %1$s uses a client that doesn't support OMEMO.",
                            this.model.contact.getDisplayName()
                        )];
                    }
                    return _converse.api.alert.show(Strophe.LogLevel.ERROR, __('Error'), messages);
                }
                ev.preventDefault();
                this.model.save({'omemo_active': !this.model.get('omemo_active')});
            }
        }
        Object.assign(_converse.ChatBoxView.prototype, OMEMOEnabledChatView);


        async function generateFingerprint (device) {
            if (_.get(device.get('bundle'), 'fingerprint')) {
                return;
            }
            const bundle = await device.getBundle();
            bundle['fingerprint'] = u.arrayBufferToHex(u.base64ToArrayBuffer(bundle['identity_key']));
            device.save('bundle', bundle);
            device.trigger('change:bundle'); // Doesn't get triggered automatically due to pass-by-reference
        }

        _converse.generateFingerprints = async function (jid) {
            const devices = await getDevicesForContact(jid)
            return Promise.all(devices.map(d => generateFingerprint(d)));
        }

        _converse.getDeviceForContact = function (jid, device_id) {
            return getDevicesForContact(jid).then(devices => devices.get(device_id));
        }

        async function getDevicesForContact (jid) {
            await _converse.api.waitUntil('OMEMOInitialized');
            const devicelist = _converse.devicelists.get(jid) || _converse.devicelists.create({'jid': jid});
            await devicelist.fetchDevices();
            return devicelist.devices;
        }

        _converse.contactHasOMEMOSupport = async function (jid) {
            /* Checks whether the contact advertises any OMEMO-compatible devices. */
            const devices = await getDevicesForContact(jid);
            return devices.length > 0;
        }

        function generateDeviceID () {
            /* Generates a device ID, making sure that it's unique */
            const existing_ids = _converse.devicelists.get(_converse.bare_jid).devices.pluck('id');
            let device_id = libsignal.KeyHelper.generateRegistrationId();
            let i = 0;
            while (_.includes(existing_ids, device_id)) {
                device_id = libsignal.KeyHelper.generateRegistrationId();
                i++;
                if (i == 10) {
                    throw new Error("Unable to generate a unique device ID");
                }
            }
            return device_id.toString();
        }

        async function buildSession (device) {
            const address = new libsignal.SignalProtocolAddress(device.get('jid'), device.get('id')),
                  sessionBuilder = new libsignal.SessionBuilder(_converse.omemo_store, address),
                  prekey = device.getRandomPreKey(),
                  bundle = await device.getBundle();

            return sessionBuilder.processPreKey({
                'registrationId': parseInt(device.get('id'), 10),
                'identityKey': u.base64ToArrayBuffer(bundle.identity_key),
                'signedPreKey': {
                    'keyId': bundle.signed_prekey.id, // <Number>
                    'publicKey': u.base64ToArrayBuffer(bundle.signed_prekey.public_key),
                    'signature': u.base64ToArrayBuffer(bundle.signed_prekey.signature)
                },
                'preKey': {
                    'keyId': prekey.id, // <Number>
                    'publicKey': u.base64ToArrayBuffer(prekey.key),
                }
            });
        }

        async function getSession (device) {
            const address = new libsignal.SignalProtocolAddress(device.get('jid'), device.get('id'));
            const session = await _converse.omemo_store.loadSession(address.toString());
            if (session) {
                return Promise.resolve(session);
            } else {
                try {
                    const session = await buildSession(device);
                    return session;
                } catch (e) {
                    _converse.log(
                        `Could not build an OMEMO session for device ${device.get('id')}`,
                        Strophe.LogLevel.ERROR
                    );
                    _converse.log(e, Strophe.LogLevel.ERROR);
                    return null;
                }
            }
        }

        _converse.getBundlesAndBuildSessions = async function (chatbox) {
            const no_devices_err = __("Sorry, no devices found to which we can send an OMEMO encrypted message.");
            let devices;
            if (chatbox.get('type') === _converse.CHATROOMS_TYPE) {
                const collections = await Promise.all(chatbox.occupants.map(o => getDevicesForContact(o.get('jid'))));
                devices = collections.reduce((a, b) => _.concat(a, b.models), []);
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

            await Promise.all(devices.map(d => d.getBundle()));
            const sessions = await Promise.all(devices.map(d => getSession(d)));
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
        }

        function addKeysToMessageStanza (stanza, dicts, iv) {
            for (var i in dicts) {
                if (Object.prototype.hasOwnProperty.call(dicts, i)) {
                    const payload = dicts[i].payload,
                            device = dicts[i].device,
                            prekey = 3 == parseInt(payload.type, 10);

                    stanza.c('key', {'rid': device.get('id') }).t(btoa(payload.body));
                    if (prekey) {
                        stanza.attrs({'prekey': prekey});
                    }
                    stanza.up();
                    if (i == dicts.length-1) {
                        stanza.c('iv').t(iv).up().up()
                    }
                }
            }
            return Promise.resolve(stanza);
        }

        _converse.createOMEMOMessageStanza = function (chatbox, message, devices) {
            const { __ } = _converse;
            const body = __("This is an OMEMO encrypted message which your client doesn’t seem to support. "+
                            "Find more information on https://conversations.im/omemo");

            if (!message.get('message')) {
                throw new Error("No message body to encrypt!");
            }
            const stanza = $msg({
                    'from': _converse.connection.jid,
                    'to': chatbox.get('jid'),
                    'type': chatbox.get('message_type'),
                    'id': message.get('msgid')
                }).c('body').t(body).up()

            if (message.get('type') === 'chat') {
                stanza.c('request', {'xmlns': Strophe.NS.RECEIPTS}).up();
            }
            // An encrypted header is added to the message for
            // each device that is supposed to receive it.
            // These headers simply contain the key that the
            // payload message is encrypted with,
            // and they are separately encrypted using the
            // session corresponding to the counterpart device.
            stanza.c('encrypted', {'xmlns': Strophe.NS.OMEMO})
                  .c('header', {'sid':  _converse.omemo_store.get('device_id')});

            return chatbox.encryptMessage(message.get('message')).then(obj => {
                // The 16 bytes key and the GCM authentication tag (The tag
                // SHOULD have at least 128 bit) are concatenated and for each
                // intended recipient device, i.e. both own devices as well as
                // devices associated with the contact, the result of this
                // concatenation is encrypted using the corresponding
                // long-standing SignalProtocol session.
                const promises = devices
                    .filter(device => (device.get('trusted') != UNTRUSTED && device.get('active')))
                    .map(device => chatbox.encryptKey(obj.key_and_tag, device));

                return Promise.all(promises)
                    .then(dicts => addKeysToMessageStanza(stanza, dicts, obj.iv))
                    .then(stanza => {
                        stanza.c('payload').t(obj.payload).up().up();
                        stanza.c('store', {'xmlns': Strophe.NS.HINTS});
                        return stanza;
                    });
            });
        }


        _converse.OMEMOStore = Backbone.Model.extend({

            Direction: {
                SENDING: 1,
                RECEIVING: 2,
            },

            getIdentityKeyPair () {
                const keypair = this.get('identity_keypair');
                return Promise.resolve({
                    'privKey': u.base64ToArrayBuffer(keypair.privKey),
                    'pubKey': u.base64ToArrayBuffer(keypair.pubKey)
                });
            },

            getLocalRegistrationId () {
                return Promise.resolve(parseInt(this.get('device_id'), 10));
            },

            isTrustedIdentity (identifier, identity_key, direction) {  // eslint-disable-line no-unused-vars
                if (identifier === null || identifier === undefined) {
                    throw new Error("Can't check identity key for invalid key");
                }
                if (!(identity_key instanceof ArrayBuffer)) {
                    throw new Error("Expected identity_key to be an ArrayBuffer");
                }
                const trusted = this.get('identity_key'+identifier);
                if (trusted === undefined) {
                    return Promise.resolve(true);
                }
                return Promise.resolve(u.arrayBufferToBase64(identity_key) === trusted);
            },

            loadIdentityKey (identifier) {
                if (identifier === null || identifier === undefined) {
                    throw new Error("Can't load identity_key for invalid identifier");
                }
                return Promise.resolve(u.base64ToArrayBuffer(this.get('identity_key'+identifier)));
            },

            saveIdentity (identifier, identity_key) {
                if (identifier === null || identifier === undefined) {
                    throw new Error("Can't save identity_key for invalid identifier");
                }
                const address = new libsignal.SignalProtocolAddress.fromString(identifier),
                      existing = this.get('identity_key'+address.getName());

                const b64_idkey = u.arrayBufferToBase64(identity_key);
                this.save('identity_key'+address.getName(), b64_idkey)

                if (existing && b64_idkey !== existing) {
                    return Promise.resolve(true);
                } else {
                    return Promise.resolve(false);
                }
            },

            getPreKeys () {
                return this.get('prekeys') || {};
            },

            loadPreKey (key_id) {
                const res = this.getPreKeys()[key_id];
                if (res) {
                    return Promise.resolve({
                        'privKey': u.base64ToArrayBuffer(res.privKey),
                        'pubKey': u.base64ToArrayBuffer(res.pubKey)
                    });
                }
                return Promise.resolve();
            },

            storePreKey (key_id, key_pair) {
                const prekey = {};
                prekey[key_id] = {
                    'pubKey': u.arrayBufferToBase64(key_pair.pubKey),
                    'privKey': u.arrayBufferToBase64(key_pair.privKey)
                }
                this.save('prekeys', Object.assign(this.getPreKeys(), prekey));
                return Promise.resolve();
            },

            removePreKey (key_id) {
                this.save('prekeys', _.omit(this.getPreKeys(), key_id));
                return Promise.resolve();
            },

            loadSignedPreKey (keyId) {  // eslint-disable-line no-unused-vars
                const res = this.get('signed_prekey');
                if (res) {
                    return Promise.resolve({
                        'privKey': u.base64ToArrayBuffer(res.privKey),
                        'pubKey': u.base64ToArrayBuffer(res.pubKey)
                    });
                }
                return Promise.resolve();
            },

            storeSignedPreKey (spk) {
                if (typeof spk !== "object") {
                    // XXX: We've changed the signature of this method from the
                    // example given in InMemorySignalProtocolStore.
                    // Should be fine because the libsignal code doesn't
                    // actually call this method.
                    throw new Error("storeSignedPreKey: expected an object");
                }
                this.save('signed_prekey', {
                    'id': spk.keyId,
                    'privKey': u.arrayBufferToBase64(spk.keyPair.privKey),
                    'pubKey': u.arrayBufferToBase64(spk.keyPair.pubKey),
                    // XXX: The InMemorySignalProtocolStore does not pass
                    // in or store the signature, but we need it when we
                    // publish out bundle and this method isn't called from
                    // within libsignal code, so we modify it to also store
                    // the signature.
                    'signature': u.arrayBufferToBase64(spk.signature)
                });
                return Promise.resolve();
            },

            removeSignedPreKey (key_id) {
                if (this.get('signed_prekey')['id'] === key_id) {
                    this.unset('signed_prekey');
                    this.save();
                }
                return Promise.resolve();
            },

            loadSession (identifier) {
                return Promise.resolve(this.get('session'+identifier));
            },

            storeSession (identifier, record) {
                return Promise.resolve(this.save('session'+identifier, record));
            },

            removeSession (identifier) {
                return Promise.resolve(this.unset('session'+identifier));
            },

            removeAllSessions (identifier) {
                const keys = _.filter(Object.keys(this.attributes), (key) => {
                    if (key.startsWith('session'+identifier)) {
                        return key;
                    }
                });
                const attrs = {};
                _.forEach(keys, (key) => {attrs[key] = undefined});
                this.save(attrs);
                return Promise.resolve();
            },

            publishBundle () {
                const signed_prekey = this.get('signed_prekey');
                const node = `${Strophe.NS.OMEMO_BUNDLES}:${this.get('device_id')}`;
                const item = $build('item')
                    .c('bundle', {'xmlns': Strophe.NS.OMEMO})
                        .c('signedPreKeyPublic', {'signedPreKeyId': signed_prekey.id})
                            .t(signed_prekey.pubKey).up()
                        .c('signedPreKeySignature').t(signed_prekey.signature).up()
                        .c('identityKey').t(this.get('identity_keypair').pubKey).up()
                        .c('prekeys');
                _.forEach(
                    this.get('prekeys'),
                    (prekey, id) => item.c('preKeyPublic', {'preKeyId': id}).t(prekey.pubKey).up()
                );
                const options = {'pubsub#access_model': 'open'};
                return _converse.api.pubsub.publish(null, node, item, options, false);
            },

            async generateMissingPreKeys () {
                const missing_keys = _.difference(
                    _.invokeMap(_.range(0, _converse.NUM_PREKEYS), Number.prototype.toString),
                    Object.keys(this.getPreKeys())
                );
                if (missing_keys.length < 1) {
                    _converse.log("No missing prekeys to generate for our own device", Strophe.LogLevel.WARN);
                    return Promise.resolve();
                }
                const keys = await Promise.all(missing_keys.map(id => libsignal.KeyHelper.generatePreKey(parseInt(id, 10))));
                keys.forEach(k => this.storePreKey(k.keyId, k.keyPair));
                const marshalled_keys = Object.keys(this.getPreKeys()).map(k => ({'id': k.keyId, 'key': u.arrayBufferToBase64(k.pubKey)}));
                const devicelist = _converse.devicelists.get(_converse.bare_jid);
                const device = devicelist.devices.get(this.get('device_id'));
                const bundle = await device.getBundle();
                device.save('bundle', Object.assign(bundle, {'prekeys': marshalled_keys}));
            },

            async generateBundle () {
                /* The first thing that needs to happen if a client wants to
                 * start using OMEMO is they need to generate an IdentityKey
                 * and a Device ID. The IdentityKey is a Curve25519 [6]
                 * public/private Key pair. The Device ID is a randomly
                 * generated integer between 1 and 2^31 - 1.
                 */
                const identity_keypair = await libsignal.KeyHelper.generateIdentityKeyPair();
                const bundle = {},
                      identity_key = u.arrayBufferToBase64(identity_keypair.pubKey),
                      device_id = generateDeviceID();

                bundle['identity_key'] = identity_key;
                bundle['device_id'] = device_id;
                this.save({
                    'device_id': device_id,
                    'identity_keypair': {
                        'privKey': u.arrayBufferToBase64(identity_keypair.privKey),
                        'pubKey': identity_key
                    },
                    'identity_key': identity_key
                });
                const signed_prekey = await libsignal.KeyHelper.generateSignedPreKey(identity_keypair, 0);

                _converse.omemo_store.storeSignedPreKey(signed_prekey);
                bundle['signed_prekey'] = {
                    'id': signed_prekey.keyId,
                    'public_key': u.arrayBufferToBase64(signed_prekey.keyPair.privKey),
                    'signature': u.arrayBufferToBase64(signed_prekey.signature)
                }
                const keys = await Promise.all(_.range(0, _converse.NUM_PREKEYS).map(id => libsignal.KeyHelper.generatePreKey(id)));
                keys.forEach(k => _converse.omemo_store.storePreKey(k.keyId, k.keyPair));
                const devicelist = _converse.devicelists.get(_converse.bare_jid);
                const device = devicelist.devices.create({'id': bundle.device_id, 'jid': _converse.bare_jid});
                const marshalled_keys = keys.map(k => ({'id': k.keyId, 'key': u.arrayBufferToBase64(k.keyPair.pubKey)}));
                bundle['prekeys'] = marshalled_keys;
                device.save('bundle', bundle);
            },

            fetchSession () {
                if (this._setup_promise === undefined) {
                    this._setup_promise = new Promise((resolve, reject) => {
                        this.fetch({
                            'success': () => {
                                if (!_converse.omemo_store.get('device_id')) {
                                    this.generateBundle().then(resolve).catch(reject);
                                } else {
                                    resolve();
                                }
                            },
                            'error': (model, resp) => {
                                _converse.log(
                                    "Could not fetch OMEMO session from cache, we'll generate a new one.",
                                    Strophe.LogLevel.WARN
                                );
                                _converse.log(resp, Strophe.LogLevel.WARN);
                                this.generateBundle().then(resolve).catch(reject);
                            }
                        });
                    });
                }
                return this._setup_promise;
            }
        });

        _converse.Device = Backbone.Model.extend({
            defaults: {
                'trusted': UNDECIDED,
                'active': true
            },

            getRandomPreKey () {
                // XXX: assumes that the bundle has already been fetched
                const bundle = this.get('bundle');
                return bundle.prekeys[u.getRandomInt(bundle.prekeys.length)];
            },

            async fetchBundleFromServer () {
                const stanza = $iq({
                    'type': 'get',
                    'from': _converse.bare_jid,
                    'to': this.get('jid')
                }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                    .c('items', {'node': `${Strophe.NS.OMEMO_BUNDLES}:${this.get('id')}`});

                let iq;
                try {
                    iq = await _converse.api.sendIQ(stanza)
                } catch (iq) {
                    throw new IQError("Could not fetch bundle", iq);
                }
                if (iq.querySelector('error')) {
                    throw new IQError("Could not fetch bundle", iq);
                }
                const publish_el = sizzle(`items[node="${Strophe.NS.OMEMO_BUNDLES}:${this.get('id')}"]`, iq).pop(),
                      bundle_el = sizzle(`bundle[xmlns="${Strophe.NS.OMEMO}"]`, publish_el).pop(),
                      bundle = parseBundle(bundle_el);
                this.save('bundle', bundle);
                return bundle;
            },

            getBundle () {
                /* Fetch and save the bundle information associated with
                 * this device, if the information is not at hand already.
                 */
                if (this.get('bundle')) {
                    return Promise.resolve(this.get('bundle'), this);
                } else {
                    return this.fetchBundleFromServer();
                }
            }
        });

        _converse.Devices = _converse.Collection.extend({
            model: _converse.Device,
        });

        /**
         * @class
         * @namespace _converse.DeviceList
         * @memberOf _converse
         */
        _converse.DeviceList = Backbone.Model.extend({
            idAttribute: 'jid',

            initialize () {
                this.devices = new _converse.Devices();
                const id = `converse.devicelist-${_converse.bare_jid}-${this.get('jid')}`;
                const storage = _converse.config.get('storage');
                this.devices.browserStorage = new BrowserStorage[storage](id);
                this.fetchDevices();
            },

            async onDevicesFound (collection) {
                if (collection.length === 0) {
                    let ids;
                    try {
                        ids = await this.fetchDevicesFromServer()
                    } catch (e) {
                        if (e === null) {
                            _converse.log(`Timeout error while fetching devices for ${this.get('jid')}`, Strophe.LogLevel.ERROR);
                        } else {
                            _converse.log(`Could not fetch devices for ${this.get('jid')}`, Strophe.LogLevel.ERROR);
                            _converse.log(e, Strophe.LogLevel.ERROR);
                        }
                        this.destroy();
                    }
                    if (this.get('jid') === _converse.bare_jid) {
                        await this.publishCurrentDevice(ids);
                    }
                }
            },

            fetchDevices () {
                if (this._devices_promise === undefined) {
                    this._devices_promise = new Promise(resolve => {
                        this.devices.fetch({
                            'success': c => resolve(this.onDevicesFound(c)),
                            'error': e => { _converse.log(e, Strophe.LogLevel.ERROR); resolve(); }
                        });
                    });
                }
                return this._devices_promise;
            },

            async publishCurrentDevice (device_ids) {
                if (this.get('jid') !== _converse.bare_jid) {
                    return // We only publish for ourselves.
                }
                await restoreOMEMOSession();
                let device_id = _converse.omemo_store.get('device_id');
                if (!this.devices.findWhere({'id': device_id})) {
                    // Generate a new bundle if we cannot find our device
                    await _converse.omemo_store.generateBundle();
                    device_id = _converse.omemo_store.get('device_id');
                }
                if (!_.includes(device_ids, device_id)) {
                    return this.publishDevices();
                }
            },

            async fetchDevicesFromServer () {
                const stanza = $iq({
                    'type': 'get',
                    'from': _converse.bare_jid,
                    'to': this.get('jid')
                }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                    .c('items', {'node': Strophe.NS.OMEMO_DEVICELIST});

                let iq;
                try {
                    iq = await _converse.api.sendIQ(stanza);
                } catch (e) {
                    _converse.log(e, Strophe.LogLevel.ERROR);
                    return [];
                }
                const device_ids = sizzle(`list[xmlns="${Strophe.NS.OMEMO}"] device`, iq).map(dev => dev.getAttribute('id'));
                _.forEach(device_ids, id => this.devices.create({'id': id, 'jid': this.get('jid')}));
                return device_ids;
            },

            publishDevices () {
                const item = $build('item').c('list', {'xmlns': Strophe.NS.OMEMO})
                this.devices.filter(d => d.get('active')).forEach(d => item.c('device', {'id': d.get('id')}).up());
                const options = {'pubsub#access_model': 'open'};
                return _converse.api.pubsub.publish(null, Strophe.NS.OMEMO_DEVICELIST, item, options, false);
            },

            removeOwnDevices (device_ids) {
                if (this.get('jid') !== _converse.bare_jid) {
                    throw new Error("Cannot remove devices from someone else's device list");
                }
                _.forEach(device_ids, (device_id) => this.devices.get(device_id).destroy());
                return this.publishDevices();
            }
        });

        /**
         * @class
         * @namespace _converse.DeviceLists
         * @memberOf _converse
         */
        _converse.DeviceLists = _converse.Collection.extend({
            model: _converse.DeviceList,
            /**
             * Returns the {@link _converse.DeviceList} for a particular JID.
             * The device list will be created if it doesn't exist already.
             * @private
             * @method _converse.DeviceLists#getDeviceList
             * @param { String } jid - The Jabber ID for which the device list will be returned.
             */
            getDeviceList (jid) {
                return this.get(jid) || this.create({'jid': jid});
            }
        });


        function fetchDeviceLists () {
            return new Promise((success, error) => _converse.devicelists.fetch({success, error}));
        }

        async function fetchOwnDevices () {
            await fetchDeviceLists();
            let own_devicelist = _converse.devicelists.get(_converse.bare_jid);
            if (!own_devicelist) {
                own_devicelist = _converse.devicelists.create({'jid': _converse.bare_jid});
            }
            return own_devicelist.fetchDevices();
        }

        function updateBundleFromStanza (stanza) {
            const items_el = sizzle(`items`, stanza).pop();
            if (!items_el || !items_el.getAttribute('node').startsWith(Strophe.NS.OMEMO_BUNDLES)) {
                return;
            }
            const device_id = items_el.getAttribute('node').split(':')[1],
                  jid = stanza.getAttribute('from'),
                  bundle_el = sizzle(`item > bundle`, items_el).pop(),
                  devicelist = _converse.devicelists.getDeviceList(jid),
                  device = devicelist.devices.get(device_id) || devicelist.devices.create({'id': device_id, 'jid': jid});
            device.save({'bundle': parseBundle(bundle_el)});
        }

        function updateDevicesFromStanza (stanza) {
            const items_el = sizzle(`items[node="${Strophe.NS.OMEMO_DEVICELIST}"]`, stanza).pop();
            if (!items_el) {
                return;
            }
            const device_selector = `item list[xmlns="${Strophe.NS.OMEMO}"] device`;
            const device_ids = sizzle(device_selector, items_el).map(d => d.getAttribute('id'));
            const jid = stanza.getAttribute('from');
            const devicelist = _converse.devicelists.getDeviceList(jid);
            const devices = devicelist.devices;
            const removed_ids = _.difference(devices.pluck('id'), device_ids);

            removed_ids.forEach(id => {
                if (jid === _converse.bare_jid && id === _converse.omemo_store.get('device_id')) {
                    return // We don't set the current device as inactive
                }
                devices.get(id).save('active', false);
            });
            device_ids.forEach(device_id => {
                const device = devices.get(device_id);
                if (device) {
                    device.save('active', true);
                } else {
                    devices.create({'id': device_id, 'jid': jid})
                }
            });
            if (u.isSameBareJID(jid, _converse.bare_jid)) {
                // Make sure our own device is on the list
                // (i.e. if it was removed, add it again).
                devicelist.publishCurrentDevice(device_ids);
            }
        }

        function registerPEPPushHandler () {
            // Add a handler for devices pushed from other connected clients
            _converse.connection.addHandler((message) => {
                try {
                    if (sizzle(`event[xmlns="${Strophe.NS.PUBSUB}#event"]`, message).length) {
                        updateDevicesFromStanza(message);
                        updateBundleFromStanza(message);
                    }
                } catch (e) {
                    _converse.log(e.message, Strophe.LogLevel.ERROR);
                }
                return true;
            }, null, 'message', 'headline');
        }

        function restoreOMEMOSession () {
            if (_converse.omemo_store === undefined)  {
                const storage = _converse.config.get('storage'),
                      id = `converse.omemosession-${_converse.bare_jid}`;
                _converse.omemo_store = new _converse.OMEMOStore({'id': id});
                _converse.omemo_store.browserStorage = new BrowserStorage[storage](id);
            }
            return _converse.omemo_store.fetchSession();
        }

        async function initOMEMO () {
            if (!_converse.config.get('trusted')) {
                return;
            }
            _converse.devicelists = new _converse.DeviceLists();
            const storage = _converse.config.get('storage'),
                  id = `converse.devicelists-${_converse.bare_jid}`;
            _converse.devicelists.browserStorage = new BrowserStorage[storage](id);

            try {
                await fetchOwnDevices();
                await restoreOMEMOSession();
                await _converse.omemo_store.publishBundle();
            } catch (e) {
                _converse.log("Could not initialize OMEMO support", Strophe.LogLevel.ERROR);
                _converse.log(e, Strophe.LogLevel.ERROR);
                return;
            }
            /**
             * Triggered once OMEMO support has been initialized
             * @event _converse#OMEMOInitialized
             * @example _converse.api.listen.on('OMEMOInitialized', () => { ... });
             */
            _converse.api.trigger('OMEMOInitialized');
        }

        async function onOccupantAdded (chatroom, occupant) {
            if (occupant.isSelf() || !chatroom.features.get('nonanonymous') || !chatroom.features.get('membersonly')) {
                return;
            }
            if (chatroom.get('omemo_active')) {
                const supported = await _converse.contactHasOMEMOSupport(occupant.get('jid'));
                if (!supported) {
                        chatroom.messages.create({
                            'message': __("%1$s doesn't appear to have a client that supports OMEMO. " +
                                          "Encrypted chat will no longer be possible in this grouchat.", occupant.get('nick')),
                            'type': 'error'
                        });
                    chatroom.save({'omemo_active': false, 'omemo_supported': false});
                }
            }
        }

        async function checkOMEMOSupported (chatbox) {
            let supported;
            if (chatbox.get('type') === _converse.CHATROOMS_TYPE) {
                await _converse.api.waitUntil('OMEMOInitialized');
                supported = chatbox.features.get('nonanonymous') && chatbox.features.get('membersonly');
            } else if (chatbox.get('type') === _converse.PRIVATE_CHAT_TYPE) {
                supported = await _converse.contactHasOMEMOSupport(chatbox.get('jid'));
            }
            chatbox.set('omemo_supported', supported);
            if (supported && _converse.omemo_default) {
                chatbox.set('omemo_active', true);
            }
        }

        /******************** Event Handlers ********************/

        _converse.api.waitUntil('chatBoxesInitialized').then(() =>
            _converse.chatboxes.on('add', chatbox => {
                checkOMEMOSupported(chatbox);
                if (chatbox.get('type') === _converse.CHATROOMS_TYPE) {
                    chatbox.occupants.on('add', o => onOccupantAdded(chatbox, o));
                    chatbox.features.on('change', () => checkOMEMOSupported(chatbox));
                }
            })
        );

        _converse.api.listen.on('connected', registerPEPPushHandler);
        _converse.api.listen.on('renderToolbar', view => view.renderOMEMOToolbarButton());
        _converse.api.listen.on('statusInitialized', initOMEMO);
        _converse.api.listen.on('addClientFeatures',
            () => _converse.api.disco.own.features.add(`${Strophe.NS.OMEMO_DEVICELIST}+notify`));

        _converse.api.listen.on('userDetailsModalInitialized', (contact) => {
            const jid = contact.get('jid');
            _converse.generateFingerprints(jid).catch(e => _converse.log(e, Strophe.LogLevel.ERROR));
        });

        _converse.api.listen.on('profileModalInitialized', () => {
            _converse.generateFingerprints(_converse.bare_jid).catch(e => _converse.log(e, Strophe.LogLevel.ERROR));
        });

        _converse.api.listen.on('afterTearDown', () => (delete _converse.omemo_store));

        _converse.api.listen.on('clearSession', () => {
            if (_converse.shouldClearCache() && _converse.devicelists) {
                _converse.devicelists.clearSession();
                delete _converse.devicelists;
            }
        });


        /************************ API ************************/

        Object.assign(_converse.api, {
            /**
             * The "omemo" namespace groups methods relevant to OMEMO
             * encryption.
             *
             * @namespace _converse.api.omemo
             * @memberOf _converse.api
             */
            'omemo': {
                /**
                 * The "bundle" namespace groups methods relevant to the user's
                 * OMEMO bundle.
                 *
                 * @namespace _converse.api.omemo.bundle
                 * @memberOf _converse.api.omemo
                 */
                'bundle': {
                    /**
                     * Lets you generate a new OMEMO device bundle
                     *
                     * @method _converse.api.omemo.bundle.generate
                     * @returns {promise} Promise which resolves once we have a result from the server.
                     */
                    'generate': async () => {
                        // Remove current device
                        const devicelist = _converse.devicelists.get(_converse.bare_jid),
                              device_id = _converse.omemo_store.get('device_id');
                        if (device_id) {
                            const device = devicelist.devices.get(device_id);
                            _converse.omemo_store.unset(device_id);
                            if (device) {
                                await new Promise(done => device.destroy({'success': done, 'error': done}));
                            }
                            devicelist.devices.trigger('remove');
                        }
                        // Generate new bundle and publish
                        await _converse.omemo_store.generateBundle();
                        await devicelist.publishDevices();
                        const device = devicelist.devices.get(_converse.omemo_store.get('device_id'));
                        return generateFingerprint(device);
                    }
                }
            }
        });
    }
});

