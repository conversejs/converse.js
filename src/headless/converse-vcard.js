// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)
/**
 * @module converse-vcard
 */
import "./converse-status";
import converse from "./converse-core";
import tpl_vcard from "./templates/vcard.html";

const { Backbone, Strophe, _, $iq, dayjs, } = converse.env;
const u = converse.env.utils;


converse.plugins.add('converse-vcard', {

    dependencies: ["converse-status", "converse-roster"],

    overrides: {
        XMPPStatus: {
            getNickname () {
                const { _converse } = this.__super__;
                const nick = this.__super__.getNickname.apply(this);
                if (!nick && _converse.xmppstatus.vcard) {
                    return _converse.xmppstatus.vcard.get('nickname');
                } else {
                    return nick;
                }
            },

            getFullname (){
                const { _converse } = this.__super__;
                const fullname = this.__super__.getFullname.apply(this);
                if (!fullname && _converse.xmppstatus.vcard) {
                    return _converse.xmppstatus.vcard.get('fullname');
                } else {
                    return fullname;
                }
            }
        },

        RosterContact: {
            getDisplayName () {
                if (!this.get('nickname') && this.vcard) {
                    return this.vcard.getDisplayName();
                } else {
                    return this.__super__.getDisplayName.apply(this);
                }
            },
            getFullname () {
                if (this.vcard) {
                    return this.vcard.get('fullname');
                } else {
                    return this.__super__.getFullname.apply(this);
                }
            }
        }
    },

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this;

        _converse.api.promises.add('VCardsInitialized');


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
            },

            getDisplayName () {
                return this.get('nickname') || this.get('fullname') || this.get('jid');
            }
        });


        _converse.VCards = _converse.Collection.extend({
            model: _converse.VCard,

            initialize () {
                this.on('add', vcard => {
                    _converse.api.vcard.update(vcard);
                });
            }
        });


        async function onVCardData (jid, iq) {
            const vcard = iq.querySelector('vCard');
            let result = {};
            if (vcard !== null) {
                result = {
                    'stanza': iq,
                    'fullname': _.get(vcard.querySelector('FN'), 'textContent'),
                    'nickname': _.get(vcard.querySelector('NICKNAME'), 'textContent'),
                    'image': _.get(vcard.querySelector('PHOTO BINVAL'), 'textContent'),
                    'image_type': _.get(vcard.querySelector('PHOTO TYPE'), 'textContent'),
                    'url': _.get(vcard.querySelector('URL'), 'textContent'),
                    'role': _.get(vcard.querySelector('ROLE'), 'textContent'),
                    'email': _.get(vcard.querySelector('EMAIL USERID'), 'textContent'),
                    'vcard_updated': (new Date()).toISOString(),
                    'vcard_error': undefined
                };
            }
            if (result.image) {
                const buffer = u.base64ToArrayBuffer(result['image']);
                const ab = await crypto.subtle.digest('SHA-1', buffer);
                result['image_hash'] = u.arrayBufferToHex(ab);
            }
            return result;
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

        async function getVCard (_converse, jid) {
            const to = Strophe.getBareJidFromJid(jid) === _converse.bare_jid ? null : jid;
            let iq;
            try {
                iq = await _converse.api.sendIQ(createStanza("get", to))
            } catch (iq) {
                return {
                    'stanza': iq,
                    'jid': jid,
                    'vcard_error': (new Date()).toISOString()
                }
            }
            return onVCardData(jid, iq);
        }

        /************************ BEGIN Event Handlers ************************/
        _converse.initVCardCollection = async function () {
            _converse.vcards = new _converse.VCards();
            _converse.vcards.browserStorage = _converse.createStore(`${_converse.bare_jid}-converse.vcards`);
            await new Promise(resolve => {
                _converse.vcards.fetch({
                    'success': resolve,
                    'error': resolve
                }, {'silent': true});
            });
            const vcards = _converse.vcards;
            if (_converse.session) {
                const jid = _converse.session.get('bare_jid');
                _converse.xmppstatus.vcard = vcards.findWhere({'jid': jid}) || vcards.create({'jid': jid});
            }
            /**
             * Triggered as soon as the `_converse.vcards` collection has been initialized and populated from cache.
             * @event _converse#VCardsInitialized
             */
            _converse.api.trigger('VCardsInitialized');
        }

        _converse.api.listen.on('statusInitialized', _converse.initVCardCollection);

        _converse.api.listen.on('clearSession', () => {
            if (_converse.shouldClearCache()) {
                _converse.api.promises.add('VCardsInitialized');
                if (_converse.vcards) {
                    _converse.vcards.clearSession();
                    delete _converse.vcards;
                }
            }
        });


        _converse.api.listen.on('addClientFeatures', () => _converse.api.disco.own.features.add(Strophe.NS.VCARD));


        async function setVCardOnModel (model) {
            let jid;
            if (model instanceof _converse.Message) {
                if (model.get('type') === 'error') {
                    return;
                }
                jid = model.get('from');
            } else {
                jid = model.get('jid');
            }
            await _converse.api.waitUntil('VCardsInitialized');
            model.vcard = _converse.vcards.findWhere({'jid': jid});
            if (!model.vcard) {
                model.vcard = _converse.vcards.create({'jid': jid});
            }
        }
        _converse.api.listen.on('rosterContactInitialized', m => setVCardOnModel(m));
        _converse.api.listen.on('messageInitialized', m => setVCardOnModel(m));


        /************************ BEGIN API ************************/
        Object.assign(_converse.api, {
            /**
             * The XEP-0054 VCard API
             *
             * This API lets you access and update user VCards
             *
             * @namespace _converse.api.vcard
             * @memberOf _converse.api
             */
            'vcard': {
                /**
                 * Enables setting new values for a VCard.
                 *
                 * @method _converse.api.vcard.set
                 * @param {string} jid The JID for which the VCard should be set
                 * @param {object} data A map of VCard keys and values
                 * @example
                 * _converse.api.vcard.set({
                 *     'jid': _converse.bare_jid,
                 *     'fn': 'John Doe',
                 *     'nickname': 'jdoe'
                 * }).then(() => {
                 *     // Succes
                 * }).catch(() => {
                 *     // Failure
                 * }).
                 */
                set (jid, data) {
                    if (!jid) {
                        throw Error("No jid provided for the VCard data");
                    }
                    const vcard_el = Strophe.xmlHtmlNode(tpl_vcard(data)).firstElementChild;
                    return _converse.api.sendIQ(createStanza("set", jid, vcard_el));
                },

                /**
                 * @method _converse.api.vcard.get
                 * @param {Backbone.Model|string} model Either a `Backbone.Model` instance, or a string JID.
                 *     If a `Backbone.Model` instance is passed in, then it must have either a `jid`
                 *     attribute or a `muc_jid` attribute.
                 * @param {boolean} [force] A boolean indicating whether the vcard should be
                 *     fetched even if it's been fetched before.
                 * @returns {promise} A Promise which resolves with the VCard data for a particular JID or for
                 *     a `Backbone.Model` instance which represents an entity with a JID (such as a roster contact,
                 *     chat or chatroom occupant).
                 *
                 * @example
                 * _converse.api.waitUntil('rosterContactsFetched').then(() => {
                 *     _converse.api.vcard.get('someone@example.org').then(
                 *         (vcard) => {
                 *             // Do something with the vcard...
                 *         }
                 *     );
                 * });
                 */
                 get (model, force) {
                    if (_.isString(model)) {
                        return getVCard(_converse, model);
                    } else if (force ||
                            !model.get('vcard_updated') ||
                            !dayjs(model.get('vcard_error')).isSame(new Date(), "day")) {

                        const jid = model.get('jid');
                        if (!jid) {
                            throw new Error("No JID to get vcard for!");
                        }
                        return getVCard(_converse, jid);
                    } else {
                        return Promise.resolve({});
                    }
                },

                /**
                 * Fetches the VCard associated with a particular `Backbone.Model` instance
                 * (by using its `jid` or `muc_jid` attribute) and then updates the model with the
                 * returned VCard data.
                 *
                 * @method _converse.api.vcard.update
                 * @param {Backbone.Model} model A `Backbone.Model` instance
                 * @param {boolean} [force] A boolean indicating whether the vcard should be
                 *     fetched again even if it's been fetched before.
                 * @returns {promise} A promise which resolves once the update has completed.
                 * @example
                 * _converse.api.waitUntil('rosterContactsFetched').then(async () => {
                 *     const chatbox = await _converse.chatboxes.getChatBox('someone@example.org');
                 *     _converse.api.vcard.update(chatbox);
                 * });
                 */
                async update (model, force) {
                    const data = await this.get(model, force);
                    delete data['stanza']
                    model.save(data);
                }
            }
        });
    }
});
