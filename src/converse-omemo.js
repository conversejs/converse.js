// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

/* global libsignal, ArrayBuffer, parseInt, crypto */

import converse from "@converse/headless/converse-core";
import tpl_toolbar_omemo from "templates/toolbar_omemo.html";

const { Backbone, Promise, Strophe, moment, sizzle, $build, $iq, $msg, _, f } = converse.env;
const u = converse.env.utils;

Strophe.addNamespace('OMEMO_DEVICELIST', Strophe.NS.OMEMO+".devicelist");
Strophe.addNamespace('OMEMO_VERIFICATION', Strophe.NS.OMEMO+".verification");
Strophe.addNamespace('OMEMO_WHITELISTED', Strophe.NS.OMEMO+".whitelisted");
Strophe.addNamespace('OMEMO_BUNDLES', Strophe.NS.OMEMO+".bundles");

const UNDECIDED = 0;
const TRUSTED = 1;
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
    const signed_prekey_public_el = bundle_el.querySelector('signedPreKeyPublic'),
          signed_prekey_signature_el = bundle_el.querySelector('signedPreKeySignature'),
          identity_key_el = bundle_el.querySelector('identityKey');

    const prekeys = _.map(
        sizzle(`prekeys > preKeyPublic`, bundle_el),
        (el) => {
            return {
                'id': parseInt(el.getAttribute('preKeyId'), 10),
                'key': el.textContent
            }
        });
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
        return !_.isNil(window.libsignal) && !f.includes('converse-omemo', _converse.blacklisted_plugins) && _converse.config.get('trusted');
    },

    dependencies: ["converse-chatview", "converse-pubsub"],

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
                this.devicelist.devices.on('change:bundle', this.debouncedRender, this);
                this.devicelist.devices.on('reset', this.debouncedRender, this);
                this.devicelist.devices.on('reset', this.debouncedRender, this);
                this.devicelist.devices.on('remove', this.debouncedRender, this);
                this.devicelist.devices.on('add', this.debouncedRender, this);
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
                const checkboxes = ev.target.querySelectorAll('.fingerprint-removal-item input[type="checkbox"]:checked'),
                      device_ids = _.map(checkboxes, 'value');
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
                this.devicelist = _converse.devicelists.get(jid) || _converse.devicelists.create({'jid': jid});
                this.devicelist.devices.on('change:bundle', this.render, this);
                this.devicelist.devices.on('change:trusted', this.render, this);
                this.devicelist.devices.on('remove', this.render, this);
                this.devicelist.devices.on('add', this.render, this);
                this.devicelist.devices.on('reset', this.render, this);
                return this.__super__.initialize.apply(this, arguments);
            },

            toggleDeviceTrust (ev) {
                const radio = ev.target;
                const device = this.devicelist.devices.get(radio.getAttribute('name'));
                device.save('trusted', parseInt(radio.value, 10));
            }
        },

        ChatBox: {

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
                const { _converse } = this.__super__;
                if (_converse.debug) {
                    const { __ } = _converse;
                    this.messages.create({
                        'message': __("Sorry, could not decrypt a received OMEMO message due to an error.") + ` ${e.name} ${e.message}`,
                        'type': 'error',
                    });
                }
                _converse.log(`${e.name} ${e.message}`, Strophe.LogLevel.ERROR);
            },

            decrypt (attrs) {
                const { _converse } = this.__super__,
                      session_cipher = this.getSessionCipher(attrs.from, parseInt(attrs.encrypted.device_id, 10));

                // https://xmpp.org/extensions/xep-0384.html#usecases-receiving
                if (attrs.encrypted.prekey === 'true') {
                    let plaintext;
                    return session_cipher.decryptPreKeyWhisperMessage(u.base64ToArrayBuffer(attrs.encrypted.key), 'binary')
                        .then(key_and_tag => {
                            if (attrs.encrypted.payload) {
                                const key = key_and_tag.slice(0, 16),
                                      tag = key_and_tag.slice(16);
                                return this.decryptMessage(_.extend(attrs.encrypted, {'key': key, 'tag': tag}));
                            }
                            return Promise.resolve();
                        }).then(pt => {
                            plaintext = pt;
                            return _converse.omemo_store.generateMissingPreKeys();
                        }).then(() => _converse.omemo_store.publishBundle())
                          .then(() => {
                            if (plaintext) {
                                return _.extend(attrs, {'plaintext': plaintext});
                            } else {
                                return _.extend(attrs, {'is_only_key': true});
                            }
                        }).catch(e => {
                            this.reportDecryptionError(e);
                            return attrs;
                        });
                } else {
                    return session_cipher.decryptWhisperMessage(u.base64ToArrayBuffer(attrs.encrypted.key), 'binary')
                        .then(key_and_tag => {
                            const key = key_and_tag.slice(0, 16),
                                  tag = key_and_tag.slice(16);
                            return this.decryptMessage(_.extend(attrs.encrypted, {'key': key, 'tag': tag}));
                        }).then(plaintext => _.extend(attrs, {'plaintext': plaintext}))
                          .catch(e => {
                              this.reportDecryptionError(e);
                              return attrs;
                          });
                }
            },

            getEncryptionAttributesfromStanza (stanza, original_stanza, attrs) {
                const { _converse } = this.__super__,
                      encrypted = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO}"]`, original_stanza).pop(),
                      header = encrypted.querySelector('header'),
                      key = sizzle(`key[rid="${_converse.omemo_store.get('device_id')}"]`, encrypted).pop();
                if (key) {
                    attrs['is_encrypted'] = true;
                    attrs['encrypted'] = {
                        'device_id': header.getAttribute('sid'),
                        'iv': header.querySelector('iv').textContent,
                        'key': key.textContent,
                        'payload': _.get(encrypted.querySelector('payload'), 'textContent', null),
                        'prekey': key.getAttribute('prekey')
                    }
                    return this.decrypt(attrs);
                } else {
                    return Promise.resolve(attrs);
                }
            },

            async getMessageAttributesFromStanza (stanza, original_stanza) {
                const { _converse } = this.__super__,
                      encrypted = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO}"]`, original_stanza).pop(),
                      attrs = await this.__super__.getMessageAttributesFromStanza.apply(this, arguments);

                if (!encrypted || !_converse.config.get('trusted')) {
                    return attrs;
                } else {
                    return this.getEncryptionAttributesfromStanza(stanza, original_stanza, attrs);
                }
            },


            getSessionCipher (jid, id) {
                const { _converse } = this.__super__,
                        address = new libsignal.SignalProtocolAddress(jid, id);
                this.session_cipher = new window.libsignal.SessionCipher(_converse.omemo_store, address);
                return this.session_cipher;
            },

            encryptKey (plaintext, device) {
                return this.getSessionCipher(device.get('jid'), device.get('id'))
                    .encrypt(plaintext)
                    .then(payload => ({'payload': payload, 'device': device}));
            },

            handleMessageSendError (e) {
                const { _converse } = this.__super__,
                      { __ } = _converse;
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
                } else {
                    throw e;
                }
            },

            async sendMessage (attrs) {
                const { _converse } = this.__super__,
                      { __ } = _converse;

                if (this.get('omemo_active') && attrs.message) {
                    attrs['is_encrypted'] = true;
                    attrs['plaintext'] = attrs.message;
                    try {
                        const devices = await _converse.getBundlesAndBuildSessions(this);
                        const stanza = await _converse.createOMEMOMessageStanza(this, this.messages.create(attrs), devices);
                        this.sendMessageStanza(stanza);
                    } catch (e) {
                        this.handleMessageSendError(e);
                        return false;
                    }
                    return true;
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
                this.model.on('change:omemo_active', this.renderOMEMOToolbarButton, this);
                this.model.on('change:omemo_supported', this.onOMEMOSupportedDetermined, this);
            },

            showMessage (message) {
                // We don't show a message if it's only keying material
                if (!message.get('is_only_key')) {
                    return this.__super__.showMessage.apply(this, arguments);
                }
            },

            onOMEMOSupportedDetermined () {
                if (!this.model.get('omemo_supported') && this.model.get('omemo_active')) {
                    this.model.set('omemo_active', false); // Will cause render
                } else {
                    this.renderOMEMOToolbarButton();
                }
            },

            renderOMEMOToolbarButton () {
                const { _converse } = this.__super__,
                      { __ } = _converse,
                      icon = this.el.querySelector('.toggle-omemo'),
                      html = tpl_toolbar_omemo(_.extend(this.model.toJSON(), {'__': __}));

                if (icon) {
                    icon.outerHTML = html;
                } else {
                    this.el.querySelector('.chat-toolbar').insertAdjacentHTML('beforeend', html);
                }
            },

            toggleOMEMO (ev) {
                const { _converse } = this.__super__, { __ } = _converse;
                if (!this.model.get('omemo_supported')) {
                    return _converse.api.alert.show(
                        Strophe.LogLevel.ERROR,
                        __('Error'),
                        [__("Cannot use end-to-end encryption because %1$s uses a client that doesn't support OMEMO.",
                            this.model.contact.getDisplayName()
                           )]
                    )
                }
                ev.preventDefault();
                this.model.save({'omemo_active': !this.model.get('omemo_active')});
            }
        },

        ChatRoomView: {
            events: {
                'click .toggle-omemo': 'toggleOMEMO'
            },

            initialize () {
                this.__super__.initialize.apply(this, arguments);
                this.model.on('change:omemo_active', this.renderOMEMOToolbarButton, this);
                this.model.on('change:omemo_supported', this.onOMEMOSupportedDetermined, this);
            },

            toggleOMEMO (ev) {
                const { _converse } = this.__super__, { __ } = _converse;
                if (!this.model.get('omemo_supported')) {
                    return _converse.api.alert.show(
                        Strophe.LogLevel.ERROR,
                        __('Error'),
                        [__('Cannot use end-to-end encryption in this groupchat, '+
                            'either the groupchat has some anonymity or not all participants support OMEMO.')]
                    );
                }
                ev.preventDefault();
                this.model.save({'omemo_active': !this.model.get('omemo_active')});
            },

            renderOMEMOToolbarButton () {
                if (this.model.features.get('membersonly') && this.model.features.get('nonanonymous')) {
                    this.__super__.renderOMEMOToolbarButton.apply(arguments);
                } else {
                    const icon = this.el.querySelector('.toggle-omemo');
                    if (icon) {
                        icon.parentElement.removeChild(icon);
                    }
                }
            }
        }
    },

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by Converse.js's plugin machinery.
         */
        const { _converse } = this,
              { __ } = _converse;

        _converse.api.promises.add(['OMEMOInitialized']);

        _converse.NUM_PREKEYS = 100; // Set here so that tests can override

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

        function getSession (device) {
            const address = new libsignal.SignalProtocolAddress(device.get('jid'), device.get('id'));
            return _converse.omemo_store.loadSession(address.toString()).then(session => {
                if (session) {
                    return Promise.resolve();
                } else {
                    return buildSession(device);
                }
            });
        }

        _converse.getBundlesAndBuildSessions = async function (chatbox) {
            let devices;
            const id = _converse.omemo_store.get('device_id');
            if (chatbox.get('type') === _converse.CHATROOMS_TYPE) {
                const collections = await Promise.all(chatbox.occupants.map(o => getDevicesForContact(o.get('jid'))));
                devices = collections.reduce((a, b) => _.concat(a, b.models), []);

            } else if (chatbox.get('type') === _converse.PRIVATE_CHAT_TYPE) {
                const their_devices = await getDevicesForContact(chatbox.get('jid')),
                      devicelist = _converse.devicelists.get(_converse.bare_jid),
                      own_devices = devicelist.devices.filter(d => d.get('id') !== id);
                devices = _.concat(own_devices, their_devices.models);
            }
            // Filter out our own device
            devices = devices.filter(d => d.get('id') !== id);

            await Promise.all(devices.map(d => d.getBundle()));
            await Promise.all(devices.map(d => getSession(d)));
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
                    .filter(device => device.get('trusted') != UNTRUSTED)
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

            isTrustedIdentity (identifier, identity_key, direction) {
                if (_.isNil(identifier)) {
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
                if (_.isNil(identifier)) {
                    throw new Error("Can't load identity_key for invalid identifier");
                }
                return Promise.resolve(u.base64ToArrayBuffer(this.get('identity_key'+identifier)));
            },

            saveIdentity (identifier, identity_key) {
                if (_.isNil(identifier)) {
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
                this.save('prekeys', _.extend(this.getPreKeys(), prekey));
                return Promise.resolve();
            },

            removePreKey (key_id) {
                this.save('prekeys', _.omit(this.getPreKeys(), key_id));
                return Promise.resolve();
            },

            loadSignedPreKey (keyId) {
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
                const keys = _.filter(_.keys(this.attributes), (key) => {
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
                const current_keys = this.getPreKeys(),
                      missing_keys = _.difference(_.invokeMap(_.range(0, _converse.NUM_PREKEYS), Number.prototype.toString), _.keys(current_keys));

                if (missing_keys.length < 1) {
                    _converse.log("No missing prekeys to generate for our own device", Strophe.LogLevel.WARN);
                    return Promise.resolve();
                }
                const keys = await Promise.all(_.map(missing_keys, id => libsignal.KeyHelper.generatePreKey(parseInt(id, 10))));
                _.forEach(keys, k => this.storePreKey(k.keyId, k.keyPair));
                const marshalled_keys = _.map(this.getPreKeys(), k => ({'id': k.keyId, 'key': u.arrayBufferToBase64(k.pubKey)})),
                        devicelist = _converse.devicelists.get(_converse.bare_jid),
                        device = devicelist.devices.get(this.get('device_id'));

                const bundle = await device.getBundle();
                device.save('bundle', _.extend(bundle, {'prekeys': marshalled_keys}));
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
                const keys = await Promise.all(_.map(_.range(0, _converse.NUM_PREKEYS), id => libsignal.KeyHelper.generatePreKey(id)));
                _.forEach(keys, k => _converse.omemo_store.storePreKey(k.keyId, k.keyPair));
                const devicelist = _converse.devicelists.get(_converse.bare_jid),
                      device = devicelist.devices.create({'id': bundle.device_id, 'jid': _converse.bare_jid}),
                      marshalled_keys = _.map(keys, k => ({'id': k.keyId, 'key': u.arrayBufferToBase64(k.keyPair.pubKey)}));
                bundle['prekeys'] = marshalled_keys;
                device.save('bundle', bundle);
            },

            fetchSession () {
                if (_.isUndefined(this._setup_promise)) {
                    this._setup_promise = new Promise((resolve, reject) => {
                        this.fetch({
                            'success': () => {
                                if (!_converse.omemo_store.get('device_id')) {
                                    this.generateBundle().then(resolve).catch(resolve);
                                } else {
                                    resolve();
                                }
                            },
                            'error': () => {
                                this.generateBundle().then(resolve).catch(resolve);
                            }
                        });
                    });
                }
                return this._setup_promise;
            }
        });

        _converse.Device = Backbone.Model.extend({
            defaults: {
                'trusted': UNDECIDED
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

        _converse.Devices = Backbone.Collection.extend({
            model: _converse.Device,
        });

        _converse.DeviceList = Backbone.Model.extend({
            idAttribute: 'jid',

            initialize () {
                this.devices = new _converse.Devices();
                const id = `converse.devicelist-${_converse.bare_jid}-${this.get('jid')}`;
                const storage = _converse.config.get('storage');
                this.devices.browserStorage = new Backbone.BrowserStorage[storage](id);
                this.fetchDevices();
            },

            fetchDevices () {
                if (_.isUndefined(this._devices_promise)) {
                    this._devices_promise = new Promise(resolve => {
                        this.devices.fetch({
                            'success': async collection => {
                                if (collection.length === 0) {
                                    let ids;
                                    try {
                                        ids = await this.fetchDevicesFromServer()
                                    } catch (e) {
                                        _converse.log(`Could not fetch devices for ${this.get('jid')}`);
                                        _converse.log(e, Strophe.LogLevel.ERROR);
                                        this.destroy();
                                        return resolve(e);
                                    }
                                    await this.publishCurrentDevice(ids);
                                }
                                resolve();
                            },
                            'error': e => {
                                _converse.log(e, Strophe.LogLevel.ERROR);
                                resolve(e);
                            }
                        });
                    });
                }
                return this._devices_promise;
            },

            async publishCurrentDevice (device_ids) {
                if (this.get('jid') !== _converse.bare_jid) {
                    // We only publish for ourselves.
                    return
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
                const device_ids = _.map(sizzle(`list[xmlns="${Strophe.NS.OMEMO}"] device`, iq), dev => dev.getAttribute('id'));
                _.forEach(device_ids, id => this.devices.create({'id': id, 'jid': this.get('jid')}));
                return device_ids;
            },

            publishDevices () {
                const item = $build('item').c('list', {'xmlns': Strophe.NS.OMEMO})
                this.devices.each(d => item.c('device', {'id': d.get('id')}).up());
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

        _converse.DeviceLists = Backbone.Collection.extend({
            model: _converse.DeviceList,
        });


        function fetchDeviceLists () {
            return new Promise((success, error) => _converse.devicelists.fetch({success, error}));
        }

        async function fetchOwnDevices () {
            await fetchDeviceLists();
            let own_devicelist = _converse.devicelists.get(_converse.bare_jid);
            if (_.isNil(own_devicelist)) {
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
                  devicelist = _converse.devicelists.get(jid) || _converse.devicelists.create({'jid': jid}),
                  device = devicelist.devices.get(device_id) || devicelist.devices.create({'id': device_id, 'jid': jid});
            device.save({'bundle': parseBundle(bundle_el)});
        }

        function updateDevicesFromStanza (stanza) {
            const items_el = sizzle(`items[node="${Strophe.NS.OMEMO_DEVICELIST}"]`, stanza).pop();
            if (!items_el) {
                return;
            }
            const device_ids = _.map(
                sizzle(`item list[xmlns="${Strophe.NS.OMEMO}"] device`, items_el),
                (device) => device.getAttribute('id')
            );
            const jid = stanza.getAttribute('from'),
                  devicelist = _converse.devicelists.get(jid) || _converse.devicelists.create({'jid': jid}),
                  devices = devicelist.devices,
                  removed_ids = _.difference(devices.pluck('id'), device_ids);

            _.forEach(removed_ids, (id) => {
                if (jid === _converse.bare_jid && id === _converse.omemo_store.get('device_id')) {
                    // We don't remove the current device
                    return
                }
                devices.get(id).destroy();
            });

            _.forEach(device_ids, (device_id) => {
                if (!devices.get(device_id)) {
                    devices.create({'id': device_id, 'jid': jid})
                }
            });
            if (Strophe.getBareJidFromJid(jid) === _converse.bare_jid) {
                // Make sure our own device is on the list (i.e. if it was
                // removed, add it again.
                _converse.devicelists.get(_converse.bare_jid).publishCurrentDevice(device_ids);
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
            if (_.isUndefined(_converse.omemo_store))  {
                const storage = _converse.config.get('storage'),
                      id = `converse.omemosession-${_converse.bare_jid}`;
                _converse.omemo_store = new _converse.OMEMOStore({'id': id});
                _converse.omemo_store.browserStorage = new Backbone.BrowserStorage[storage](id);
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
            _converse.devicelists.browserStorage = new Backbone.BrowserStorage[storage](id);

            await fetchOwnDevices();
            await restoreOMEMOSession();
            await _converse.omemo_store.publishBundle();
            _converse.emit('OMEMOInitialized');
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
        }

        _converse.api.waitUntil('chatBoxesInitialized').then(() =>
            _converse.chatboxes.on('add', chatbox => {
                checkOMEMOSupported(chatbox);
                if (chatbox.get('type') === _converse.CHATROOMS_TYPE) {
                    chatbox.occupants.on('add', o => onOccupantAdded(chatbox, o));
                    chatbox.features.on('change', () => checkOMEMOSupported(chatbox));
                }
            })
        );

        _converse.api.listen.on('afterTearDown', () => {
            if (_converse.devicelists) {
                _converse.devicelists.reset();
            }
            delete _converse.omemo_store;
        });
        _converse.api.listen.on('connected', registerPEPPushHandler);
        _converse.api.listen.on('renderToolbar', view => view.renderOMEMOToolbarButton());
        _converse.api.listen.on('statusInitialized', initOMEMO);
        _converse.api.listen.on('addClientFeatures',
            () => _converse.api.disco.own.features.add(`${Strophe.NS.OMEMO_DEVICELIST}+notify`));

        _converse.api.listen.on('userDetailsModalInitialized', (contact) => {
            const jid = contact.get('jid');
            _converse.generateFingerprints(jid).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
        });

        _converse.api.listen.on('profileModalInitialized', (contact) => {
            _converse.generateFingerprints(_converse.bare_jid).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
        });

        /************************ BEGIN API ************************/
        _.extend(_converse.api, {
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

