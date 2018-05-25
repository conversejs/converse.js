// Converse.js
// http://conversejs.org
//
// Copyright (c) 2013-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

(function (root, factory) {
    define(["converse-core", "crypto", "tpl!vcard"], factory);
}(this, function (converse, CryptoJS, tpl_vcard) {
    "use strict";
    const { Backbone, Promise, Strophe, SHA1, _, $iq, $build, b64_sha1, moment, sizzle } = converse.env;
    const u = converse.env.utils;


    converse.plugins.add('converse-vcard', {

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this;

            _converse.VCard = Backbone.Model.extend({
                defaults: {
                    'image': _converse.DEFAULT_IMAGE,
                    'image_type': _converse.DEFAULT_IMAGE_TYPE
                },

                set (key, val, options) {
                    // Override Backbone.Model.prototype.set to make sure that the
                    // default `image` and `image_type` values are maintained.
                    let attrs;
                    if (typeof key === 'object') {
                        attrs = key;
                        options = val;
                    } else {
                        (attrs = {})[key] = val;
                    }
                    if (_.has(attrs, 'image') && !attrs['image']) {
                        attrs['image'] = _converse.DEFAULT_IMAGE;
                        attrs['image_type'] = _converse.DEFAULT_IMAGE_TYPE;
                        return Backbone.Model.prototype.set.call(this, attrs, options);
                    } else {
                        return Backbone.Model.prototype.set.apply(this, arguments);
                    }
                }
            });


            _converse.VCards = Backbone.Collection.extend({
                model: _converse.VCard,

                initialize () {
                    this.on('add', (vcard) => _converse.api.vcard.update(vcard));
                }
            });


            function onVCardData (_converse, jid, iq, callback) {
                const vcard = iq.querySelector('vCard');
                let result = {};
                if (!_.isNull(vcard)) {
                    result = {
                        'stanza': iq,
                        'fullname': _.get(vcard.querySelector('FN'), 'textContent'),
                        'nickname': _.get(vcard.querySelector('NICKNAME'), 'textContent'),
                        'image': _.get(vcard.querySelector('PHOTO BINVAL'), 'textContent'),
                        'image_type': _.get(vcard.querySelector('PHOTO TYPE'), 'textContent'),
                        'url': _.get(vcard.querySelector('URL'), 'textContent'),
                        'role': _.get(vcard.querySelector('ROLE'), 'textContent'),
                        'email': _.get(vcard.querySelector('EMAIL USERID'), 'textContent'),
                        'vcard_updated': moment().format(),
                        'vcard_error': undefined
                    };
                }
                if (result.image) {
                    const word_array_from_b64 = CryptoJS.enc.Base64.parse(result['image']);
                    result['image_hash'] = CryptoJS.SHA1(word_array_from_b64).toString()
                }
                if (callback) {
                    callback(result);
                }
            }

            function onVCardError (_converse, jid, iq, errback) {
                if (errback) {
                    errback({
                        'stanza': iq,
                        'jid': jid,
                        'vcard_error': moment().format()
                    });
                }
            }

            function createStanza (type, jid, vcard_el) {
                const iq = $iq(jid ? {'type': type, 'to': jid} : {'type': type});
                if (!vcard_el) {
                    iq.c("vCard", {'xmlns': Strophe.NS.VCARD});
                } else {
                    iq.cnode(vcard_el);
                }
                return iq;
            }

            function setVCard (data) {
                return new Promise((resolve, reject) => {
                    const vcard_el = Strophe.xmlHtmlNode(tpl_vcard(data)).firstElementChild;
                    _converse.connection.sendIQ(createStanza("set", data.jid, vcard_el), resolve, reject);
                });
            }

            function getVCard (_converse, jid) {
                /* Request the VCard of another user. Returns a promise.
                *
                * Parameters:
                *    (String) jid - The Jabber ID of the user whose VCard
                *      is being requested.
                */
                jid = Strophe.getBareJidFromJid(jid) === _converse.bare_jid ? null : jid;
                return new Promise((resolve, reject) => {
                    _converse.connection.sendIQ(
                        createStanza("get", jid),
                        _.partial(onVCardData, _converse, jid, _, resolve),
                        _.partial(onVCardError, _converse, jid, _, resolve),
                        5000
                    );
                });
            }

            /* Event handlers */
            _converse.initVCardCollection = function () {
                _converse.vcards = new _converse.VCards();
                _converse.vcards.browserStorage = new Backbone.BrowserStorage[_converse.storage](b64_sha1(`converse.vcards`));
                _converse.vcards.fetch();
            }
            _converse.api.listen.on('connectionInitialized', _converse.initVCardCollection);


            _converse.on('addClientFeatures', () => {
                _converse.api.disco.own.features.add(Strophe.NS.VCARD);
            });

            _.extend(_converse.api, {
                'vcard': {
                    'set': setVCard,

                    'get' (model, force) {
                        if (_.isString(model)) {
                            return getVCard(_converse, model);
                        } else if (force ||
                                !model.get('vcard_updated') ||
                                !moment(model.get('vcard_error')).isSame(new Date(), "day")) {

                            const jid = model.get('jid');
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
                                delete vcard['stanza']
                                model.save(vcard);
                                resolve();
                            });
                        });
                    }
                }
            });
        }
    });
}));
