// Converse.js
// http://conversejs.org
//
// Copyright (c) 2013-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

/* global libsignal */

(function (root, factory) {
    define([
        "converse-core",
        "tpl!toolbar_omemo"
    ], factory);
}(this, function (converse, tpl_toolbar_omemo) {

    const { Backbone, Promise, Strophe, sizzle, $iq, _, b64_sha1 } = converse.env;
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


    converse.plugins.add('converse-omemo', {

        enabled (_converse) {
            return !_.isNil(window.libsignal);
        },

        dependencies: ["converse-chatview"],

        overrides: {
            ChatBoxView:  {
                events: {
                    'click .toggle-omemo': 'toggleOMEMO'
                },

                toggleOMEMO (ev) {
                    ev.preventDefault();
                    this.model.save({'omemo_active': !this.model.get('omemo_active')});
                }
            }
        },

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by Converse.js's plugin machinery.
             */
            const { _converse } = this;

            _converse.api.promises.add(['OMEMOInitialized']);

            function generateBundle () {
                return new Promise((resolve, reject) => {
                    libsignal.KeyHelper.generateIdentityKeyPair().then((identity_keypair) => {
                        const data = {
                            'device_id': libsignal.KeyHelper.generateRegistrationId(),
                            'pubkey': identity_keypair.pubKey,
                            'privkey': identity_keypair.privKey,
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

                fetchSession () {
                    if (_.isUndefined(this._setup_promise)) {
                        this._setup_promise = new Promise((resolve, reject) => {
                            this.fetch({
                                'success': () => {
                                    if (!_converse.omemo_store.get('device_id')) {
                                        generateBundle()
                                            .then((data) => {
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

                addDeviceToList () {
                    /* Add this device to our list of devices stored on the
                     * server.
                     * https://xmpp.org/extensions/xep-0384.html#usecases-announcing
                     */
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
                      signed_prekey = store.get('signed_prekey');
                return new Promise((resolve, reject) => {
                    const stanza = $iq({
                        'from': _converse.bare_jid,
                        'type': 'set'
                    }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                        .c('publish', {'node': `${Strophe.NS.OMEMO_BUNDLES}:${store.get('device_id')}`})
                            .c('item')
                                .c('bundle', {'xmlns': Strophe.NS.OMEMO})
                                    .c('signedPreKeyPublic', {'signedPreKeyId': signed_prekey.keyId})
                                        .t(u.arrayBuffer2Base64(signed_prekey.keyPair.pubKey)).up()
                                    .c('signedPreKeySignature').up()
                                    .c('identityKey').up()
                                    .c('prekeys');
                    _.forEach(
                        store.get('prekeys'),
                        (prekey) => {
                            stanza.c('preKeyPublic', {'preKeyId': prekey.keyId})
                                .t(u.arrayBuffer2Base64(prekey.keyPair.pubKey)).up();
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
                    const devicelist = _converse.devicelists.get(_converse.bare_jid);
                    if (!devicelist.devices.findWhere({'id': _converse.omemo_store.get('device_id')})) {
                        return devicelist.addDeviceToList().then(resolve).catch(reject);
                    }
                    resolve();
                });
            }

            function updateDevicesFromStanza (stanza) {
                // TODO: check whether our own device_id is still on the list,
                // otherwise we need to update it.
                const device_ids = _.map(
                    sizzle(`items[node="${Strophe.NS.OMEMO_DEVICELIST}"] item[xmlns="${Strophe.NS.OMEMO}"] device`, stanza),
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
                        updateOwnDeviceList();
                    }
                }, null, 'message', 'headline', null, _converse.bare_jid);
            }

            function restoreOMEMOSession () {
                _converse.omemo_store = new _converse.OMEMOStore();
                _converse.omemo_store.browserStorage =  new Backbone.BrowserStorage.session(
                    b64_sha1(`converse.omemosession-${_converse.bare_jid}`)
                );
                return _converse.omemo_store.fetchSession()
            }

            function addOMEMOToolbarButton (view) {
                const { __ } = _converse;
                contactHasOMEMOSupport(_converse, view.model.get('jid')).then((support) => {
                    if (support) {
                        view.el.querySelector('.chat-toolbar').insertAdjacentHTML(
                            'beforeend',
                            tpl_toolbar_omemo({'__': __}));
                    }
                }).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
            }

            function initOMEMO() {
                _converse.devicelists = new _converse.DeviceLists();
                _converse.devicelists.browserStorage = new Backbone.BrowserStorage.session(
                    b64_sha1(`converse.devicelists-${_converse.bare_jid}`)
                );
                restoreOMEMOSession()
                    .then(() => publishBundle())
                    .then(() => fetchOwnDevices())
                    .then(() => updateOwnDeviceList())
                    .then(() => _converse.emit('OMEMOInitialized'))
                    .catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
            }

            _converse.api.listen.on('afterTearDown', () => _converse.devices.reset());
            _converse.api.listen.on('connected', registerPEPPushHandler);
            _converse.api.listen.on('renderToolbar', addOMEMOToolbarButton);
            _converse.api.listen.on('statusInitialized', initOMEMO);
            _converse.api.listen.on('addClientFeatures',
                () => _converse.api.disco.own.features.add(Strophe.NS.OMEMO_DEVICELIST+"notify"));
        }
    });
}));
