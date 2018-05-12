// Converse.js
// http://conversejs.org
//
// Copyright (c) 2013-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

(function (root, factory) {
    define([
        "converse-core",
        "tpl!toolbar_omemo",
        "libsignal"
    ], factory);
}(this, function (converse, tpl_toolbar_omemo, libsignal) {

    const { Backbone, Promise, Strophe, sizzle, $build, _, b64_sha1 } = converse.env;

    Strophe.addNamespace('OMEMO', "eu.siacs.conversations.axolotl");
    Strophe.addNamespace('OMEMO_DEVICELIST', Strophe.NS.OMEMO+".devicelist");
    Strophe.addNamespace('OMEMO_VERIFICATION', Strophe.NS.OMEMO+".verification");
    Strophe.addNamespace('OMEMO_WHITELISTED', Strophe.NS.OMEMO+".whitelisted");

    const UNDECIDED = 0;
    const TRUSTED = 1;
    const UNTRUSTED = -1;

    function getDevicesForContact (_converse, jid) {
        return new Promise((resolve, reject) => {
            _converse.api.waitUntil('OMEMOInitialized').then(() => {
                const devicelist = _converse.devicelists.get(jid);
                resolve(devicelist ? devicelist.devices : []);
            }).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
        });
    }

    function contactHasOMEMOSupport (_converse, jid) {
        return new Promise((resolve, reject) => {
            getDevicesForContact(_converse, jid).then((devices) => {
                resolve(devices.length > 0)
            }).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
        });
    }

    function serverHasOMEMOSupport (_converse) {
        return new Promise((resolve, reject) => {
            _converse.api.disco.getIdentity('pubsub', 'pep', _converse.bare_jid)
                .then((identity) => resolve(!_.isNil(identity)));
        });
    }

    converse.plugins.add('converse-omemo', {

        enabled (_converse) {
            return !_.isNil(window.libsignal);
        },

        overrides: {
            ChatBoxView:  {

                addOMEMOToolbarButton (options) {
                    const { _converse } = this.__super__,
                          { __ } = _converse;
                    Promise.all([
                        contactHasOMEMOSupport(_converse, this.model.get('jid')),
                        serverHasOMEMOSupport(_converse)
                    ]).then((support) => {
                        const client_supports = support[0],
                              server_supports = support[1];

                        if (client_supports && server_supports) {
                            this.el.querySelector('.chat-toolbar').insertAdjacentHTML(
                                'beforeend',
                                tpl_toolbar_omemo({'__': __}));
                        }
                    }, _.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                },

                renderToolbar (toolbar, options) {
                    const result = this.__super__.renderToolbar.apply(this, arguments);
                    this.addOMEMOToolbarButton(options);
                    return result;
                }
            }
        },

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by Converse.js's plugin machinery.
             */
            const { _converse } = this;

            _converse.api.promises.add(['OMEMOInitialized']);


            _converse.OMEMOSession = Backbone.Model.extend({

                initialize () {
                    this.keyhelper = window.libsignal.KeyHelper;
                },

                fetchSession () {
                    return new Promise((resolve, reject) => {
                        this.fetch({
                            'success': () => {
                                if (!_converse.omemo_session.get('registration_id')) {
                                    this.keyhelper.generateIdentityKeyPair().then((keypair) => {
                                        _converse.omemo_session.set({
                                            'registration_id': this.keyhelper.generateRegistrationId(),
                                            'pub_key': keypair.pubKey,
                                            'priv_key': keypair.privKey
                                        });
                                        resolve();
                                    });
                                } else {
                                    resolve();
                                }
                            }
                        });
                    });
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
                },

                fetchDevices () {
                    return new Promise((resolve, reject) => {
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
                },

                fetchDevicesFromServer () {
                    // TODO: send IQ stanza to get device list.
                    return Promise.resolve([]);
                }

            });

            _converse.DeviceLists = Backbone.Collection.extend({
                model: _converse.DeviceList,
            });


            function publishBundle () {
                // TODO: publish bundle information (public key and pre keys)
                // Keep the used device id consistant. You have to republish
                // this because you don't know if the server was restarted or might have
                // otherwise lost the information.
                return Promise.resolve();
            }

            function fetchDeviceLists () {
                return new Promise((resolve, reject) => _converse.devicelists.fetch({'success': resolve}));
            }

            function updateOwnDeviceList () {
                /* If our own device is not on the list, add it.
                 * Also, deduplicate devices if necessary.
                 */
                return new Promise((resolve, reject) => {
                    let own_devicelist = _converse.devicelists.get(_converse.bare_jid);
                    if (_.isNil(own_devicelist)) {
                        own_devicelist = _converse.devicelists.create({'jid': _converse.bare_jid});
                    }
                    own_devicelist.fetchDevices().then(resolve).catch(reject);
                    // TODO: if our own device is not onthe list, add it.
                    // TODO: deduplicate
                });
            }

            function updateDevicesFromStanza (stanza) {
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
                        _converse.bookmarks.updateDevicesFromStanza(message);
                    }
                }, null, 'message', 'headline', null, _converse.bare_jid);
            }

            function initOMEMO () {
                /* Publish our bundle and then fetch our own device list.
                 * If our device list does not contain this device's id, publish the
                 * device list with the id added. Also deduplicate device ids in the list.
                 */
                publishBundle()
                    .then(() => fetchDeviceLists())
                    .then(() => updateOwnDeviceList())
                    .then(() => _converse.emit('OMEMOInitialized'))
                    .catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
            }

            function onStatusInitialized () {
                _converse.devicelists = new _converse.DeviceLists();
                _converse.devicelists.browserStorage = new Backbone.BrowserStorage.session(
                    b64_sha1(`converse.devicelists-${_converse.bare_jid}`)
                );

                _converse.omemo_session = new _converse.OMEMOSession();
                _converse.omemo_session.browserStorage =  new Backbone.BrowserStorage.session(
                    b64_sha1(`converse.omemosession-${_converse.bare_jid}`)
                );
                _converse.omemo_session.fetchSession()
                    .then(initOMEMO)
                    .catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
            }

            _converse.api.listen.on('statusInitialized', onStatusInitialized);
            _converse.api.listen.on('connected', registerPEPPushHandler);
            _converse.api.listen.on('afterTearDown', () => _converse.devices.reset());
            _converse.api.listen.on('addClientFeatures',
                () => _converse.api.disco.own.features.add(Strophe.NS.OMEMO_DEVICELIST+"notify"));
        }
    });
}));
