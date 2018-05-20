// Converse.js
// http://conversejs.org
//
// Copyright (c) 2013-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

/* global libsignal, ArrayBuffer, parseInt */

(function (root, factory) {
    define([
        "converse-core",
        "tpl!toolbar_omemo"
    ], factory);
}(this, function (converse, tpl_toolbar_omemo) {

    const { Backbone, Promise, Strophe, moment, sizzle, $iq, $msg, _, b64_sha1 } = converse.env;
    const u = converse.env.utils;

    Strophe.addNamespace('OMEMO', "eu.siacs.conversations.axolotl");
    Strophe.addNamespace('OMEMO_DEVICELIST', Strophe.NS.OMEMO+".devicelist");
    Strophe.addNamespace('OMEMO_VERIFICATION', Strophe.NS.OMEMO+".verification");
    Strophe.addNamespace('OMEMO_WHITELISTED', Strophe.NS.OMEMO+".whitelisted");
    Strophe.addNamespace('OMEMO_BUNDLES', Strophe.NS.OMEMO+".bundles");

    const UNDECIDED = 0;
    const TRUSTED = 1;
    const UNTRUSTED = -1;


    function getDevicesForContact (_converse, jid) {
        return new Promise((resolve, reject) => {
            _converse.api.waitUntil('OMEMOInitialized').then(() => {
                let devicelist = _converse.devicelists.get(jid);
                if (_.isNil(devicelist)) {
                    devicelist = _converse.devicelists.create({'jid': jid});
                }
                devicelist.fetchDevices().then(() => resolve(devicelist.devices));

            }).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
        });
    }

    function contactHasOMEMOSupport (_converse, jid) {
        /* Checks whether the contact advertises any OMEMO-compatible devices. */
        return new Promise((resolve, reject) => {
            getDevicesForContact(_converse, jid).then((devices) => {
                resolve(devices.length > 0)
            }).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
        });
    }

    function parseBundle (bundle_el) {
        /* Given an XML element representing a user's OMEMO bundle, parse it
         * and return a map.
         */
        const signed_prekey_public_el = bundle_el.querySelector('signedPreKeyPublic'),
                signed_prekey_signature_el = bundle_el.querySelector('signedPreKeySignature'),
                identity_key_el = bundle_el.querySelector('identityKey');

        const prekeys = _.map(
            sizzle(`> prekeys > preKeyPublic`, bundle_el),
            (el) => {
                return {
                    'id': parseInt(el.getAttribute('keyId'), 10),
                    'key': u.base64ToArrayBuffer(el.textContent)
                }
            });
        return {
            'identity_key': bundle_el.querySelector('> identityKey').textContent,
            'signed_prekey': {
                'id': parseInt(signed_prekey_public_el.getAttribute('signedPreKeyId'), 10),
                'public_key': u.base64ToArrayBuffer(signed_prekey_public_el.textContent),
                'signature': u.base64ToArrayBuffer(signed_prekey_signature_el.textContent)
            },
            'prekeys': prekeys
        }
    }


    converse.plugins.add('converse-omemo', {

        enabled (_converse) {
            return !_.isNil(window.libsignal);
        },

        dependencies: ["converse-chatview"],

        overrides: {

            ChatBox: {

                parseBundleFromIQ (device_id, stanza) {
                    const publish_el = sizzle(`items[node="${Strophe.NS.OMEMO_BUNDLES}:${device_id}"]`, stanza).pop();
                    const bundle_el = sizzle(`bundle[xmlns="${Strophe.NS.OMEMO}"]`, publish_el).pop();
                    return parseBundle(bundle_el);
                },

                fetchBundle (device_id) {
                    const { _converse } = this.__super__,
                          device = _converse.devicelists.get(this.get('jid')).devices.get(device_id);

                    if (device.get('bundle')) {
                        return Promise.resolve(device.get('bundle').toJSON());
                    } else {
                        return new Promise((resolve, reject) => {
                            const stanza = $iq({
                                'type': 'get',
                                'from': _converse.bare_jid,
                                'to': this.get('jid')
                            }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                                .c('items', {'xmlns': `${Strophe.NS.OMEMO_BUNDLES}:${device_id}`});
                            _converse.connection.sendIQ(
                                stanza,
                                (iq) => {
                                    const bundle = this.parseBundleFromIQ(iq);
                                    bundle.device_id = device_id;
                                    resolve(bundle);
                                },
                                reject,
                                _converse.IQ_TIMEOUT
                            );
                        });
                    }
                },

                fetchBundlesAndBuildSessions () {
                    const { _converse } = this.__super__;
                    return new Promise((resolve, reject) => {
                        getDevicesForContact(this.get('jid'))
                            .then((devices) => {
                                const bundle_promises = _.map(devices, (device_id) => this.fetchBundle(device_id));
                                Promise.all(bundle_promises).then(() => {
                                    this.buildSessions(devices)
                                        .then(() => resolve(bundles))
                                        .catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));

                                }).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                            }).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                    }).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                },

                buildSessions (devices) {
                    const { _converse } = this.__super__,
                          device_id = _converse.omemo_store.get('device_id');

                    return Promise.all(_.map(devices, (device) => {
                        const recipient_id = device['id'];
                        const address = new libsignal.SignalProtocolAddress(recipient_id, device_id);
                        const sessionBuilder = new libsignal.SessionBuilder(_converse.omemo_store, address);
                        return sessionBuilder.processPreKey({
                            'registrationId': _converse.omemo_store.get('registration_id'),
                            'identityKey': _converse.omemo_store.get('identity_keypair'),
                            'signedPreKey': {
                                'keyId': '', // <Number>,
                                'publicKey': '', // <ArrayBuffer>,
                                'signature': '', // <ArrayBuffer>
                            },
                            'preKey': {
                                'keyId': '', // <Number>,
                                'publicKey': '', // <ArrayBuffer>
                            }
                        });
                    }));
                },

                encryptMessage (message) {
                    // TODO:
                    // const { _converse } = this.__super__;
                    // const plaintext = message.get('message');
                    // const address = new libsignal.SignalProtocolAddress(recipientId, deviceId);
                    // return new Promise((resolve, reject) => {
                    //     var sessionCipher = new window.libsignal.SessionCipher(_converse.omemo_store, address);
                    //     sessionCipher.encrypt(plaintext).then((ciphertext) => {});
                    // });
                },

                createOMEMOMessageStanza (message, bundles) {
                    const { _converse } = this.__super__;
                    const body = "This is an OMEMO encrypted message which your client doesn’t seem to support. "+
                                 "Find more information on https://conversations.im/omemo";
                    return new Promise((resolve, reject) => {
                        this.encryptMessage(message).then((payload) => {
                            const stanza = $msg({
                                    'from': _converse.connection.jid,
                                    'to': this.get('jid'),
                                    'type': this.get('message_type'),
                                    'id': message.get('msgid')
                                }).c('body').t(body).up()
                                  .c('encrypted').t(payload)
                                  .c('header').t(payload).up()

                            _.forEach(bundles, (bundle) => {
                                const prekey = bundle.prekeys[Math.random(bundle.prekeys.length)].textContent;
                                stanza('key', {'rid': bundle.identity_key}).t(prekey).up()
                            });
                            // TODO: set storage hint urn:xmpp:hints
                            resolve(stanza);
                        }).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                    });
                },

                createMessageStanza (message) {
                    if (this.get('omemo_active')) {
                        return this.fetchBundlesAndBuildSessions()
                            .then((bundles) => this.createOMEMOMessageStanza(message, bundles));
                    } else {
                        return Promise.resolve(this.__super__.createMessageStanza.apply(this, arguments));
                    }
                },

                sendMessageStanza (message) {
                    const { _converse } = this.__super__;

                    // TODO: merge this back into converse-chatboxes
                    this.createMessageStanza(message).then((stanza) => {
                        _converse.connection.send(stanza);
                        if (_converse.forward_messages) {
                            // Forward the message, so that other connected resources are also aware of it.
                            _converse.connection.send(
                                $msg({
                                    'to': _converse.bare_jid,
                                    'type': this.get('message_type'),
                                    'id': message.get('msgid')
                                }).c('forwarded', {'xmlns': Strophe.NS.FORWARD})
                                    .c('delay', {
                                            'xmns': Strophe.NS.DELAY,
                                            'stamp': moment().format()
                                    }).up()
                                .cnode(stanza.tree())
                            );
                        }
                    }).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                },
            },

            ChatBoxView:  {
                events: {
                    'click .toggle-omemo': 'toggleOMEMO'
                },

                renderOMEMOToolbarButton () {
                    const { _converse } = this.__super__,
                          { __ } = _converse;
                    contactHasOMEMOSupport(_converse, this.model.get('jid')).then((support) => {
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
                return device_id;
            }


            function generateBundle () {
                /* The first thing that needs to happen if a client wants to
                 * start using OMEMO is they need to generate an IdentityKey
                 * and a Device ID. The IdentityKey is a Curve25519 [6]
                 * public/private Key pair. The Device ID is a randomly
                 * generated integer between 1 and 2^31 - 1. 
                 */
                return new Promise((resolve, reject) => {
                    libsignal.KeyHelper.generateIdentityKeyPair().then((identity_keypair) => {
                        const data = {
                            'device_id': generateDeviceID(),
                            'identity_keypair': identity_keypair,
                            'prekeys': {}
                        };
                        const signed_prekey_id = '0';
                        libsignal.KeyHelper.generateSignedPreKey(identity_keypair, signed_prekey_id)
                            .then((signed_prekey) => {
                                data['signed_prekey'] = signed_prekey;
                                const key_promises = _.map(_.range(0, 100), (id) => libsignal.KeyHelper.generatePreKey(id));
                                Promise.all(key_promises).then((keys) => {
                                    data['prekeys'] = keys;
                                    resolve(data)
                                });
                            }).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                    });
                }).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
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

                fetchSession () {
                    if (_.isUndefined(this._setup_promise)) {
                        this._setup_promise = new Promise((resolve, reject) => {
                            this.fetch({
                                'success': () => {
                                    if (!_converse.omemo_store.get('device_id')) {
                                        generateBundle()
                                            .then((data) => {
                                                // TODO: should storeSession be used here?
                                                _converse.omemo_store.save(data);
                                                resolve();
                                            }).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                                    } else {
                                        resolve();
                                    }
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
                }
            });

            _converse.Devices = Backbone.Collection.extend({
                model: _converse.Device,
            });

            _converse.DeviceList = Backbone.Model.extend({
                idAttribute: 'jid',

                initialize () {
                    this.devices = new _converse.Devices();
                    this.devices.browserStorage = new Backbone.BrowserStorage.session(
                        b64_sha1(`converse.devicelist-${_converse.bare_jid}-${this.get('jid')}`)
                    );
                    this.fetchDevices();
                },

                fetchDevices () {
                    if (_.isUndefined(this._devices_promise)) {
                        this._devices_promise = new Promise((resolve, reject) => {
                            this.devices.fetch({
                                'success': (collection) => {
                                    if (collection.length === 0) {
                                        this.fetchDevicesFromServer().then(resolve).catch(reject);
                                    } else {
                                        resolve();
                                    }
                                }
                            });
                        });
                    }
                    return this._devices_promise;
                },

                fetchDevicesFromServer () {
                    return new Promise((resolve, reject) => {
                        const stanza = $iq({
                            'type': 'get',
                            'from': _converse.bare_jid,
                            'to': this.get('jid')
                        }).c('query', {
                            'xmlns': Strophe.NS.DISCO_ITEMS,
                            'node': Strophe.NS.OMEMO_DEVICELIST
                        });
                        _converse.connection.sendIQ(
                            stanza,
                            (iq) => {
                                _.forEach(
                                    iq.querySelectorAll('device'),
                                    (dev) => this.devices.create({'id': dev.getAttribute('id')})
                                );
                                resolve();
                            },
                            reject,
                            _converse.IQ_TIMEOUT);
                    });
                },

                addDeviceToList (device_id) {
                    /* Add this device to our list of devices stored on the
                     * server.
                     * https://xmpp.org/extensions/xep-0384.html#usecases-announcing
                     */
                    this.devices.create({'id': device_id});
                    return new Promise((resolve, reject) => {
                        const stanza = $iq({
                            'from': _converse.bare_jid,
                            'type': 'set'
                        }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                            .c('publish', {'xmlns': Strophe.NS.OMEMO_DEVICELIST})
                                .c('item')
                                    .c('list', {'xmlns': Strophe.NS.OMEMO}).up()

                        this.devices.each((device) => {
                            stanza.c('device', {'id': device.get('id')}).up();
                        });
                        _converse.connection.sendIQ(stanza, resolve, reject, _converse.IQ_TIMEOUT);
                    }).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                }
            });

            _converse.DeviceLists = Backbone.Collection.extend({
                model: _converse.DeviceList,
            });


            function publishBundle () {
                const store = _converse.omemo_store,
                      signed_prekey = store.get('signed_prekey'),
                      identity_key = u.arrayBufferToBase64(store.get('identity_keypair').pubKey);

                return new Promise((resolve, reject) => {
                    const stanza = $iq({
                        'from': _converse.bare_jid,
                        'type': 'set'
                    }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                        .c('publish', {'node': `${Strophe.NS.OMEMO_BUNDLES}:${store.get('device_id')}`})
                            .c('item')
                                .c('bundle', {'xmlns': Strophe.NS.OMEMO})
                                    .c('signedPreKeyPublic', {'signedPreKeyId': signed_prekey.keyId})
                                        .t(u.arrayBufferToBase64(signed_prekey.keyPair.pubKey)).up()
                                    .c('signedPreKeySignature').up()  // TODO
                                    .c('identityKey').t(identity_key).up()
                                    .c('prekeys');
                    _.forEach(
                        store.get('prekeys'),
                        (prekey) => {
                            stanza.c('preKeyPublic', {'preKeyId': prekey.keyId})
                                .t(u.arrayBufferToBase64(prekey.keyPair.pubKey)).up();
                        });
                    _converse.connection.sendIQ(stanza, resolve, reject, _converse.IQ_TIMEOUT);
                });
            }

            function fetchDeviceLists () {
                return new Promise((resolve, reject) => _converse.devicelists.fetch({'success': resolve}));
            }

            function fetchOwnDevices () {
                return new Promise((resolve, reject) => {
                    fetchDeviceLists().then(() => {
                        let own_devicelist = _converse.devicelists.get(_converse.bare_jid);
                        if (_.isNil(own_devicelist)) {
                            own_devicelist = _converse.devicelists.create({'jid': _converse.bare_jid});
                        }
                        own_devicelist.fetchDevices().then(resolve).catch(reject);
                    });
                });
            }

            function updateOwnDeviceList () {
                /* If our own device is not on the list, add it.
                 * Also, deduplicate devices if necessary.
                 */
                return new Promise((resolve, reject) => {
                    restoreOMEMOSession().then(() => {
                        const devicelist = _converse.devicelists.get(_converse.bare_jid);
                        const device_id = _converse.omemo_store.get('device_id');
                        if (!devicelist.devices.findWhere({'id': device_id})) {
                            return devicelist.addDeviceToList(device_id).then(resolve).catch(reject);
                        }
                        resolve();
                    }).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                });
            }


            function updateBundleFromStanza (stanza) {
                const items_el = sizzle(`items[node="${Strophe.NS.OMEMO_BUNDLES}"]`, stanza),
                      device_id = items_el.getAttribute('node').split(':')[1],
                      from = stanza.getAttribute('from'),
                      bundle_el = sizzle(`item list[xmlns="${Strophe.NS.OMEMO}"] bundle`, items_el).pop(),
                      bundle = parseBundle(bundle_el);

                const device = _converse.devicelists.get(from).devices.get(device_id);
                device.save({'bundle': bundle});
            }

            function updateDevicesFromStanza (stanza) {
                // TODO: check whether our own device_id is still on the list,
                // otherwise we need to update it.
                const device_ids = _.map(
                    sizzle(`items[node="${Strophe.NS.OMEMO_DEVICELIST}"] item list[xmlns="${Strophe.NS.OMEMO}"] device`, stanza),
                    (device) => device.getAttribute('id'));

                const removed_ids = _.difference(_converse.devices.pluck('id'), device_ids);
                _.forEach(removed_ids, (removed_id) => _converse.devices.get(removed_id).set('active', false));

                _.forEach(device_ids, (device_id) => {
                    const dev = _converse.devices.get(device_id);
                    if (dev) {
                        dev.save({'active': true});
                    } else {
                        _converse.devices.create({'id': device_id})
                    }
                });
            }

            function registerPEPPushHandler () {
                // Add a handler for devices pushed from other connected clients
                _converse.connection.addHandler((message) => {
                    if (message.querySelector('event[xmlns="'+Strophe.NS.PUBSUB+'#event"]')) {
                        updateDevicesFromStanza(message);
                        updateBundleFromStanza(message);
                        updateOwnDeviceList();
                    }
                }, null, 'message', 'headline', null, _converse.bare_jid);
            }

            function restoreOMEMOSession () {
                if (_.isUndefined(_converse.omemo_store))  {
                    _converse.omemo_store = new _converse.OMEMOStore();
                    _converse.omemo_store.browserStorage =  new Backbone.BrowserStorage[_converse.storage](
                        b64_sha1(`converse.omemosession-${_converse.bare_jid}`)
                    );
                }
                return _converse.omemo_store.fetchSession();
            }

            function initOMEMO() {
                _converse.devicelists = new _converse.DeviceLists();
                _converse.devicelists.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                    b64_sha1(`converse.devicelists-${_converse.bare_jid}`)
                );
                fetchOwnDevices()
                    .then(() => updateOwnDeviceList())
                    .then(() => publishBundle())
                    .then(() => _converse.emit('OMEMOInitialized'))
                    .catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
            }

            _converse.api.listen.on('afterTearDown', () => _converse.devices.reset());
            _converse.api.listen.on('connected', registerPEPPushHandler);
            _converse.api.listen.on('renderToolbar', (view) => view.renderOMEMOToolbarButton());
            _converse.api.listen.on('statusInitialized', initOMEMO);
            _converse.api.listen.on('addClientFeatures',
                () => _converse.api.disco.own.features.add(Strophe.NS.OMEMO_DEVICELIST+"notify"));
        }
    });
}));
