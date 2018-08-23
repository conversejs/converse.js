// Converse.js
// http://conversejs.org
//
// Copyright (c) 2013-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

/* global libsignal, ArrayBuffer, parseInt */

(function (root, factory) {
    define([
        "converse-core",
        "templates/toolbar_omemo.html"
    ], factory);
}(this, function (converse, tpl_toolbar_omemo) {

    const { Backbone, Promise, Strophe, moment, sizzle, $iq, $msg, _, f, b64_sha1 } = converse.env;
    const u = converse.env.utils;

    Strophe.addNamespace('OMEMO', "eu.siacs.conversations.axolotl");
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
        'length': 256
    };


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
            'identity_key': bundle_el.querySelector('identityKey').textContent,
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
            return !_.isNil(window.libsignal) && !f.includes('converse-omemo', _converse.blacklisted_plugins);
        },

        dependencies: ["converse-chatview"],

        overrides: {

            ProfileModal: {
                events: {
                    'change input.select-all': 'selectAll',
                    'submit .fingerprint-removal': 'removeSelectedFingerprints'
                },

                initialize () {
                    const { _converse } = this.__super__;
                    this.debouncedRender = _.debounce(this.render, 50);
                    this.devicelist = _converse.devicelists.get(_converse.bare_jid);
                    this.devicelist.devices.on('change:bundle', this.debouncedRender, this);
                    this.devicelist.devices.on('reset', this.debouncedRender, this);
                    this.devicelist.devices.on('remove', this.debouncedRender, this);
                    return this.__super__.initialize.apply(this, arguments);
                },

                beforeRender () {
                    const { _converse } = this.__super__,
                          device_id = _converse.omemo_store.get('device_id');
                    this.current_device = this.devicelist.devices.get(device_id);
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

                getBundlesAndBuildSessions () {
                    const { _converse } = this.__super__;
                    return new Promise((resolve, reject) => {
                        _converse.getDevicesForContact(this.get('jid'))
                            .then((their_devices) => {
                                const device_id = _converse.omemo_store.get('device_id'),
                                      devicelist = _converse.devicelists.get(_converse.bare_jid),
                                      own_devices = devicelist.devices.filter(device => device.get('id') !== device_id),
                                      devices = _.concat(own_devices, their_devices.models);

                                Promise.all(devices.map(device => device.getBundle()))
                                    .then(() => this.buildSessions(devices))
                                    .then(() => resolve(devices))
                                    .catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                            }).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                        });
                },

                buildSession (device) {
                    const { _converse } = this.__super__;
                    const bundle = device.get('bundle'),
                            address = new libsignal.SignalProtocolAddress(device.get('jid'), device.get('id')),
                            sessionBuilder = new libsignal.SessionBuilder(_converse.omemo_store, address),
                            prekey = device.getRandomPreKey();

                    try {
                        return sessionBuilder.processPreKey({
                            'registrationId': parseInt(_converse.omemo_store.get('device_id'), 10),
                            'identityKey': u.base64ToArrayBuffer(_converse.omemo_store.get('identity_key')),
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
                    } catch (e) {
                        _converse.log(`Error: could not build session for device ${device.get('id')}`, Strophe.LogLevel.ERROR);
                        _converse.log(e.message, Strophe.LogLevel.ERROR);
                        return Promise.resolve();
                    }
                },

                getKeyAndTag (string) {
                    return {
                        'key': string.slice(0, 43), // 256bit key
                        'tag': string.slice(43, string.length) // rest is tag
                    }
                },

                decryptMessage (obj) {
                    const { _converse } = this.__super__,
                          key_obj = {
                              "alg": "A256GCM",
                              "ext": true,
                              "k": obj.key,
                              "key_ops": ["encrypt","decrypt"],
                              "kty": "oct"
                          };
                    return crypto.subtle.importKey('jwk', key_obj, KEY_ALGO, true, ['encrypt','decrypt'])
                        .then((key_obj) => {
                            const algo = {
                                'name': "AES-GCM",
                                'iv': u.base64ToArrayBuffer(obj.iv),
                                'tagLength': TAG_LENGTH 
                            }
                            return window.crypto.subtle.decrypt(algo, key_obj, u.base64ToArrayBuffer(obj.payload));
                        }).then(out => (new TextDecoder()).decode(out))
                          .catch(e => _converse.log(e.toString(), Strophe.LogLevel.ERROR));
                },

                decryptFromKeyAndTag (key_and_tag, obj) {
                    const aes_data = this.getKeyAndTag(u.arrayBufferToString(key_and_tag));
                    return this.decryptMessage(_.extend(obj, {'key': aes_data.key, 'tag': aes_data.tag}));
                },

                handlePreKeyMessage (attrs) {
                    // TODO
                    const { _converse } = this.__super__;
                    // If this is the case, a new session is built from this received element. The client
                    // SHOULD then republish their bundle information, replacing the used PreKey, such
                    // that it won't be used again by a different client. If the client already has a session
                    // with the sender's device, it MUST replace this session with the newly built session.
                    // The client MUST delete the private key belonging to the PreKey after use.
                    const address  = new libsignal.SignalProtocolAddress(attrs.from, attrs.encrypted.device_id),
                            session_cipher = new window.libsignal.SessionCipher(_converse.omemo_store, address),
                            libsignal_payload = JSON.parse(atob(attrs.encrypted.key));

                    return session_cipher.decryptPreKeyWhisperMessage(libsignal_payload.body, 'binary')
                        .then(key_and_tag => this.decryptFromKeyAndTag(key_and_tag, attrs.encrypted))
                        .then((f) => {
                            // TODO handle new key...
                            // _converse.omemo.publishBundle()
                        });
                },

                decrypt (attrs) {
                    if (attrs.prekey === 'true') {
                        return this.handlePreKeyMessage(attrs)
                    }
                    const { _converse } = this.__super__,
                          address  = new libsignal.SignalProtocolAddress(attrs.from, attrs.encrypted.device_id),
                          session_cipher = new window.libsignal.SessionCipher(_converse.omemo_store, address),
                          libsignal_payload = JSON.parse(atob(attrs.encrypted.key));

                    return new Promise((resolve, reject) => {
                        session_cipher.decryptWhisperMessage(libsignal_payload.body, 'binary')
                        .then((key_and_tag) => this.decryptFromKeyAndTag(key_and_tag, attrs.encrypted))
                        .then(resolve)
                        .catch(reject);
                    });
                },

                getEncryptionAttributesfromStanza (stanza, original_stanza, attrs) {
                    const { _converse } = this.__super__,
                          encrypted = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO}"]`, original_stanza).pop();

                    return new Promise((resolve, reject) => {
                        const { _converse } = this.__super__,
                                header = encrypted.querySelector('header'),
                                key = sizzle(`key[rid="${_converse.omemo_store.get('device_id')}"]`, encrypted).pop();

                        if (key) {
                            attrs['encrypted'] = {
                                'device_id': header.getAttribute('sid'),
                                'iv': header.querySelector('iv').textContent,
                                'key': key.textContent,
                                'payload': _.get(encrypted.querySelector('payload'), 'textContent', null),
                                'prekey': key.getAttribute('prekey')
                            }
                            this.decrypt(attrs)
                                .then((plaintext) => resolve(_.extend(attrs, {'plaintext': plaintext})))
                                .catch(reject);
                        }
                    });
                },

                getMessageAttributesFromStanza (stanza, original_stanza) {
                    const encrypted = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO}"]`, original_stanza).pop();
                    const attrs = this.__super__.getMessageAttributesFromStanza.apply(this, arguments);
                    if (!encrypted) {
                        return attrs;
                    } else {
                        return this.getEncryptionAttributesfromStanza(stanza, original_stanza, attrs);
                    }
                },

                buildSessions (devices) {
                    return Promise.all(devices.map(device => this.buildSession(device)));
                },

                encryptMessage (plaintext) {
                    // The client MUST use fresh, randomly generated key/IV pairs
                    // with AES-128 in Galois/Counter Mode (GCM).
                    const iv = window.crypto.getRandomValues(new window.Uint8Array(16));
                    let key;
                    return window.crypto.subtle.generateKey(
                        KEY_ALGO,
                        true, // extractable
                        ["encrypt", "decrypt"] // key usages
                    ).then((result) => {
                        key = result;
                        const algo = {
                            'name': 'AES-GCM',
                            'iv': iv,
                            'tagLength': TAG_LENGTH
                        }
                        return window.crypto.subtle.encrypt(algo, key, new TextEncoder().encode(plaintext));
                    }).then((ciphertext) => {
                        return window.crypto.subtle.exportKey("jwk", key)
                            .then((key_obj) => {
                                const tag = u.arrayBufferToBase64(ciphertext.slice(ciphertext.byteLength - ((TAG_LENGTH + 7) >> 3)));
                                console.log('XXXX: Base64 TAG is '+tag);
                                console.log('YYY: KEY is '+key_obj.k);
                                return Promise.resolve({
                                    'key': key_obj.k,
                                    'tag': tag,
                                    'key_and_tag': btoa(key_obj.k + tag),
                                    'payload': u.arrayBufferToBase64(ciphertext),
                                    'iv': u.arrayBufferToBase64(iv)
                                });
                            });
                    });
                },

                encryptKey (plaintext, device) {
                    const { _converse } = this.__super__,
                          address = new libsignal.SignalProtocolAddress(this.get('jid'), device.get('id')),
                          session_cipher = new window.libsignal.SessionCipher(_converse.omemo_store, address);

                    return new Promise((resolve, reject) => {
                        session_cipher.encrypt(plaintext)
                            .then(payload => resolve({'payload': payload, 'device': device}))
                            .catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                        });
                },

                addKeysToMessageStanza (stanza, dicts, iv) {
                    for (var i in dicts) {
                        if (Object.prototype.hasOwnProperty.call(dicts, i)) {
                            const payload = dicts[i].payload,
                                  device = dicts[i].device,
                                  prekey = 3 == parseInt(payload.type, 10);

                            stanza.c('key', {'rid': device.get('id') }).t(btoa(JSON.stringify(dicts[i].payload)));
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
                },

                createOMEMOMessageStanza (message, devices) {
                    const { _converse } = this.__super__, { __ } = _converse;
                    const body = __("This is an OMEMO encrypted message which your client doesn’t seem to support. "+
                                    "Find more information on https://conversations.im/omemo");

                    const stanza = $msg({
                            'from': _converse.connection.jid,
                            'to': this.get('jid'),
                            'type': this.get('message_type'),
                            'id': message.get('msgid')
                        }).c('body').t(body).up()
                            // An encrypted header is added to the message for
                            // each device that is supposed to receive it.
                            // These headers simply contain the key that the
                            // payload message is encrypted with,
                            // and they are separately encrypted using the
                            // session corresponding to the counterpart device.
                            .c('encrypted', {'xmlns': Strophe.NS.OMEMO})
                                .c('header', {'sid':  _converse.omemo_store.get('device_id')});

                    return this.encryptMessage(message).then((obj) => {
                        // The 16 bytes key and the GCM authentication tag (The tag
                        // SHOULD have at least 128 bit) are concatenated and for each
                        // intended recipient device, i.e. both own devices as well as
                        // devices associated with the contact, the result of this
                        // concatenation is encrypted using the corresponding
                        // long-standing SignalProtocol session.
                        const promises = devices
                            .filter(device => device.get('trusted') != UNTRUSTED)
                            .map(device => this.encryptKey(obj.key_and_tag, device));

                        return Promise.all(promises)
                            .then((dicts) => this.addKeysToMessageStanza(stanza, dicts, obj.iv))
                            .then((stanza) => stanza.c('payload').t(obj.payload))
                            .catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                    });
                },

                sendMessage (attrs) {
                    const { _converse } = this.__super__;
                    if (this.get('omemo_active')) {
                        const message = this.messages.create(attrs);
                        this.getBundlesAndBuildSessions()
                            .then(devices => this.createOMEMOMessageStanza(message, devices))
                            .then(stanza => this.sendMessageStanza(stanza))
                            .catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                    } else {
                        return this.__super__.sendMessage.apply(this, arguments);
                    }
                }
            },

            ChatBoxView:  {
                events: {
                    'click .toggle-omemo': 'toggleOMEMO'
                },

                renderOMEMOToolbarButton () {
                    const { _converse } = this.__super__,
                          { __ } = _converse;
                    _converse.contactHasOMEMOSupport(this.model.get('jid')).then((support) => {
                        if (support) {
                            const icon = this.el.querySelector('.toggle-omemo'),
                                html = tpl_toolbar_omemo(_.extend(this.model.toJSON(), {'__': __}));
                            if (icon) {
                                icon.outerHTML = html;
                            } else {
                                this.el.querySelector('.chat-toolbar').insertAdjacentHTML('beforeend', html);
                            }
                        }
                    }).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                },

                toggleOMEMO (ev) {
                    ev.preventDefault();
                    this.model.save({'omemo_active': !this.model.get('omemo_active')});
                    this.renderOMEMOToolbarButton();
                }
            }
        },

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by Converse.js's plugin machinery.
             */
            const { _converse } = this;

            _converse.api.promises.add(['OMEMOInitialized']);

            _converse.NUM_PREKEYS = 100; // Set here so that tests can override

            function generateFingerprint (device) {
                let bundle;
                return device.getBundle().then(b => {
                    bundle = b;
                    return crypto.subtle.digest('SHA-1', u.base64ToArrayBuffer(bundle['identity_key']));
                }).then(fp => {
                    bundle['fingerprint'] = u.arrayBufferToHex(fp);
                    device.save('bundle', bundle);
                    device.trigger('change:bundle'); // Doesn't get triggered automatically due to pass-by-reference
                });
            }

            _converse.generateFingerprints = function (jid) {
                return _converse.getDevicesForContact(jid)
                    .then(devices => Promise.all(devices.map(d => generateFingerprint(d))))
            }

            _converse.getDevicesForContact = function (jid) {
                let devicelist;
                return _converse.api.waitUntil('OMEMOInitialized')
                    .then(() => {
                        devicelist = _converse.devicelists.get(jid) || _converse.devicelists.create({'jid': jid});
                        return devicelist.fetchDevices();
                    }).then(() => devicelist.devices);
            }

            _converse.contactHasOMEMOSupport = function (jid) {
                /* Checks whether the contact advertises any OMEMO-compatible devices. */
                return new Promise((resolve, reject) => {
                    _converse.getDevicesForContact(jid)
                        .then((devices) => resolve(devices.length > 0))
                        .catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                });
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


            _converse.OMEMOStore = Backbone.Model.extend({

                Direction: {
                    SENDING: 1,
                    RECEIVING: 2,
                },

                getIdentityKeyPair () {
                    return Promise.resolve(this.get('identity_keypair'));
                },

                getLocalRegistrationId () {
                    return Promise.resolve(this.get('device_id'));
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
                    return Promise.resolve(u.arrayBufferToString(identity_key) === u.arrayBufferToString(trusted));
                },

                loadIdentityKey (identifier) {
                    if (_.isNil(identifier)) {
                        throw new Error("Can't load identity_key for invalid identifier");
                    }
                    return Promise.resolve(this.get('identity_key'+identifier));
                },

                saveIdentity (identifier, identity_key) {
                    if (_.isNil(identifier)) {
                        throw new Error("Can't save identity_key for invalid identifier");
                    }
                    const address = new libsignal.SignalProtocolAddress.fromString(identifier),
                          existing = this.get('identity_key'+address.getName());
                    this.save('identity_key'+address.getName(), identity_key)
                    if (existing && u.arrayBufferToString(identity_key) !== u.arrayBufferToString(existing)) {
                        return Promise.resolve(true);
                    } else {
                        return Promise.resolve(false);
                    }
                },

                loadPreKey (keyId) {
                    let res = this.get('25519KeypreKey'+keyId);
                    if (_.isUndefined(res)) {
                        res = {'pubKey': res.pubKey, 'privKey': res.privKey};
                    }
                    return Promise.resolve(res);
                },

                storePreKey (keyId, keyPair) {
                    return Promise.resolve(this.save('25519KeypreKey'+keyId, keyPair));
                },

                removePreKey (keyId) {
                    return Promise.resolve(this.unset('25519KeypreKey'+keyId));
                },

                loadSignedPreKey (keyId) {
                    let res = this.get('25519KeysignedKey'+keyId);
                    if (res !== undefined) {
                        res = {'pubKey': res.pubKey, 'privKey': res.privKey};
                    }
                    return Promise.resolve(res);
                },

                storeSignedPreKey (keyId, keyPair) {
                    return Promise.resolve(this.save('25519KeysignedKey'+keyId, keyPair));
                },

                removeSignedPreKey (keyId) {
                    return Promise.resolve(this.unset('25519KeysignedKey'+keyId));
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

                generateBundle () {
                    /* The first thing that needs to happen if a client wants to
                     * start using OMEMO is they need to generate an IdentityKey
                     * and a Device ID. The IdentityKey is a Curve25519 [6]
                     * public/private Key pair. The Device ID is a randomly
                     * generated integer between 1 and 2^31 - 1.
                     */
                    const data = {
                        'device_id': generateDeviceID()
                    };
                    return libsignal.KeyHelper.generateIdentityKeyPair()
                        .then(identity_keypair => {
                            data['identity_keypair'] = identity_keypair;
                            data['identity_key'] = u.arrayBufferToBase64(identity_keypair.pubKey);
                            return libsignal.KeyHelper.generateSignedPreKey(identity_keypair, 1);
                        }).then(signed_prekey => {
                            _converse.omemo_store.storeSignedPreKey(signed_prekey.keyId, signed_prekey.keyPair);
                            data['signed_prekey'] = signed_prekey;
                            return Promise.all(_.map(_.range(0, _converse.NUM_PREKEYS), id => libsignal.KeyHelper.generatePreKey(id)));
                        }).then(keys => {
                            _.forEach(keys, k => _converse.omemo_store.storePreKey(k.keyId, k.keyPair));
                            data['prekeys'] = keys;

                            this.save(data)
                            // Save the bundle to the device
                            const devicelist = _converse.devicelists.get(_converse.bare_jid),
                                  device = devicelist.devices.create({'id': data.device_id, 'jid': _converse.bare_jid});
                            device.save('bundle', data);
                        });
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
                    'active': true,
                    'trusted': UNDECIDED
                },

                getRandomPreKey () {
                    // XXX: assumes that the bundle has already been fetched
                    const bundle = this.get('bundle');
                    return bundle.prekeys[u.getRandomInt(bundle.prekeys.length)];
                },

                fetchBundleFromServer () {
                    const stanza = $iq({
                        'type': 'get',
                        'from': _converse.bare_jid,
                        'to': this.get('jid')
                    }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                        .c('items', {'node': `${Strophe.NS.OMEMO_BUNDLES}:${this.get('id')}`});

                    return _converse.api.sendIQ(stanza)
                        .then(iq => {
                            const publish_el = sizzle(`items[node="${Strophe.NS.OMEMO_BUNDLES}:${this.get('id')}"]`, iq).pop(),
                                    bundle_el = sizzle(`bundle[xmlns="${Strophe.NS.OMEMO}"]`, publish_el).pop(),
                                    bundle = parseBundle(bundle_el);
                            this.save('bundle', bundle);
                            return bundle;
                        }).catch(iq => {
                            _converse.log(iq.outerHTML, Strophe.LogLevel.ERROR);
                        });
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
                    this.devices.browserStorage = new Backbone.BrowserStorage.session(id);
                    this.fetchDevices();
                },

                fetchDevices () {
                    if (_.isUndefined(this._devices_promise)) {
                        this._devices_promise = new Promise((resolve, reject) => {
                            this.devices.fetch({
                                'success': (collection) => {
                                    if (collection.length === 0) {
                                        this.fetchDevicesFromServer()
                                            .then(ids => this.publishCurrentDevice(ids))
                                            .then(resolve)
                                            .catch(resolve);
                                    } else {
                                        resolve();
                                    }
                                }
                            });
                        });
                    }
                    return this._devices_promise;
                },

                publishCurrentDevice (device_ids) {
                    if (this.get('jid') !== _converse.bare_jid) {
                        // We only publish for ourselves.
                        return Promise.resolve();
                    }
                    return restoreOMEMOSession()
                        .then(() => {
                            const device_id = _converse.omemo_store.get('device_id'),
                                  own_device = this.devices.findWhere({'id': device_id});

                            if (!_.includes(device_ids, device_id) || !own_device.get('active')) {
                                own_device.save('active', true, {'silent': true});
                                return this.publishDevices();
                            }
                        });
                },

                fetchDevicesFromServer () {
                    const stanza = $iq({
                        'type': 'get',
                        'from': _converse.bare_jid,
                        'to': this.get('jid')
                    }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                        .c('items', {'node': Strophe.NS.OMEMO_DEVICELIST});
                    return _converse.api.sendIQ(stanza)
                        .then(iq => {
                            const device_ids = _.map(sizzle(`list[xmlns="${Strophe.NS.OMEMO}"] device`, iq), dev => dev.getAttribute('id'));
                            _.forEach(device_ids, id => this.devices.create({'id': id, 'jid': this.get('jid')}));
                            return device_ids;
                        });
                },

                publishDevices () {
                    const stanza = $iq({
                        'from': _converse.bare_jid,
                        'type': 'set'
                    }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                        .c('publish', {'node': Strophe.NS.OMEMO_DEVICELIST})
                            .c('item')
                                .c('list', {'xmlns': Strophe.NS.OMEMO})
                    _.each(this.devices.where({'active': true}), (device) => {
                        stanza.c('device', {'id': device.get('id')}).up();
                    });
                    return _converse.api.sendIQ(stanza);
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


            _converse.omemo = {

                publishBundle () {
                    const store = _converse.omemo_store,
                          signed_prekey = store.get('signed_prekey');

                    const stanza = $iq({
                        'from': _converse.bare_jid,
                        'type': 'set'
                    }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                        .c('publish', {'node': `${Strophe.NS.OMEMO_BUNDLES}:${store.get('device_id')}`})
                            .c('item')
                                .c('bundle', {'xmlns': Strophe.NS.OMEMO})
                                    .c('signedPreKeyPublic', {'signedPreKeyId': signed_prekey.keyId})
                                        .t(u.arrayBufferToBase64(signed_prekey.keyPair.pubKey)).up()
                                    .c('signedPreKeySignature')
                                        .t(u.arrayBufferToBase64(signed_prekey.signature)).up()
                                    .c('identityKey')
                                        .t(u.arrayBufferToBase64(store.get('identity_keypair').pubKey)).up()
                                    .c('prekeys');
                    _.forEach(
                        store.get('prekeys').slice(0, _converse.NUM_PREKEYS),
                        (prekey) => {
                            stanza.c('preKeyPublic', {'preKeyId': prekey.keyId})
                                .t(u.arrayBufferToBase64(prekey.keyPair.pubKey)).up();
                        });
                    return _converse.api.sendIQ(stanza);
                }
            }

            function fetchDeviceLists () {
                return new Promise((resolve, reject) => _converse.devicelists.fetch({
                    'success': resolve
                }));
            }

            function fetchOwnDevices () {
                return fetchDeviceLists().then(() => {
                    let own_devicelist = _converse.devicelists.get(_converse.bare_jid);
                    if (_.isNil(own_devicelist)) {
                        own_devicelist = _converse.devicelists.create({'jid': _converse.bare_jid});
                    }
                    return own_devicelist.fetchDevices();
                });
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

                _.forEach(removed_ids, (removed_id) => devices.get(removed_id).save('active', false));
                _.forEach(device_ids, (device_id) => {
                    const dev = devices.get(device_id);
                    if (dev) {
                        dev.save({'active': true});
                    } else {
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

            function initOMEMO() {
                _converse.devicelists = new _converse.DeviceLists();
                const storage = _converse.config.get('storage'),
                      id = `converse.devicelists-${_converse.bare_jid}`;
                _converse.devicelists.browserStorage = new Backbone.BrowserStorage[storage](id);

                fetchOwnDevices()
                    .then(() => restoreOMEMOSession())
                    .then(() => _converse.omemo.publishBundle())
                    .then(() => _converse.emit('OMEMOInitialized'))
                    .catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
            }

            _converse.api.listen.on('afterTearDown', () => {
                _converse.devicelists.reset();
                delete _converse.omemo_store;
            });
            _converse.api.listen.on('connected', registerPEPPushHandler);
            _converse.api.listen.on('renderToolbar', (view) => view.renderOMEMOToolbarButton());
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
        }
    });
}));
