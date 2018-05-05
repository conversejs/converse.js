// Converse.js
// http://conversejs.org
//
// Copyright (c) 2012-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

(function (root, factory) {
    define(["converse-core", "crypto", "strophe.vcard"], factory);
}(this, function (converse, CryptoJS) {
    "use strict";
    const { Backbone, Promise, Strophe, SHA1, _, b64_sha1, moment, sizzle } = converse.env;
    const u = converse.env.utils;


    function onVCardData (_converse, jid, iq, callback) {
        const vcard = iq.querySelector('vCard');
        let result = {};
        if (!_.isNull(vcard)) {
            result = {
                'stanza': iq,
                'fullname': _.get(vcard.querySelector('FN'), 'textContent'),
                'image': _.get(vcard.querySelector('PHOTO BINVAL'), 'textContent'),
                'image_type': _.get(vcard.querySelector('PHOTO TYPE'), 'textContent'),
                'url': _.get(vcard.querySelector('URL'), 'textContent')
            };
        }
        if (result.image) {
            const word_array_from_b64 = CryptoJS.enc.Base64.parse(result['image']);
            result['image_type'] = CryptoJS.SHA1(word_array_from_b64).toString()
        }
        if (callback) {
            callback(result);
        }
    }

    function onVCardError (_converse, jid, iq, errback) {
        if (errback) {
            errback({'stanza': iq, 'jid': jid});
        }
    }

    function getVCard (_converse, jid) {
        /* Request the VCard of another user. Returns a promise.
         *
         * Parameters:
         *    (String) jid - The Jabber ID of the user whose VCard
         *      is being requested.
         */
        const to = Strophe.getBareJidFromJid(jid) === _converse.bare_jid ? null : jid;
        return new Promise((resolve, reject) => {
            _converse.connection.vcard.get(
                _.partial(onVCardData, _converse, jid, _, resolve),
                to,
                _.partial(onVCardError, _converse, jid, _, resolve)
            );
        });
    }


    converse.plugins.add('converse-vcard', {

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this;

            _converse.VCards = Backbone.Collection.extend({
                model: _converse.ModelWithDefaultAvatar,

                initialize () {
                    this.on('add', (vcard) => _converse.api.vcard.update(vcard));
                }
            });


            /* Event handlers */
            _converse.initVCardCollection = function () {
                _converse.vcards = new _converse.VCards();
                _converse.vcards.browserStorage = new Backbone.BrowserStorage.local(b64_sha1(`converse.vcards`));
                _converse.vcards.fetch();
            }
            _converse.api.listen.on('connectionInitialized', _converse.initVCardCollection);


            _converse.on('addClientFeatures', () => {
                _converse.connection.disco.addFeature(Strophe.NS.VCARD);
            });

            _converse.on('statusInitialized', function fetchOwnVCard () {
                _converse.api.disco.supports(Strophe.NS.VCARD, _converse.domain)
                    .then((result) => {
                        if (result.length) {
                            _converse.api.vcard.update(_converse.xmppstatus);
                        }})
                    .catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
            });

            _.extend(_converse.api, {
                'vcard': {
                    'get' (model, force) {
                        if (_.isString(model)) {
                            return getVCard(_converse, model);
                        } else if (!model.get('vcard_updated') || force) {
                            const jid = model.get('jid') || model.get('muc_jid');
                            if (!jid) {
                                throw new Error("No JID to get vcard for!");
                            }
                            return getVCard(_converse, jid);
                        } else {
                            return Promise.resolve({});
                        }
                    },

                    'update' (model, force) {
                        return new Promise((resolve, reject) => {
                            this.get(model, force).then((vcard) => {
                                model.save(_.extend(
                                    _.pick(vcard, ['fullname', 'url', 'image_type', 'image', 'image_hash']),
                                    {'vcard_updated': moment().format()}
                                ));
                                resolve();
                            });
                        });
                    }
                }
            });
        }
    });
}));
