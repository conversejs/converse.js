/**
 * @module converse-vcard
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "./status";
import log from "@converse/headless/log";
import { Collection } from "@converse/skeletor/src/collection";
import { Model } from '@converse/skeletor/src/model.js';
import { _converse, api, converse } from "../core.js";
import { initStorage } from '@converse/headless/utils/storage.js';

const { Strophe, $iq, dayjs } = converse.env;
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

            getFullname () {
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
        api.promises.add('VCardsInitialized');


        /**
         * Represents a VCard
         * @class
         * @namespace _converse.VCard
         * @memberOf _converse
         */
        _converse.VCard = Model.extend({
            defaults: {
                'image': _converse.DEFAULT_IMAGE,
                'image_type': _converse.DEFAULT_IMAGE_TYPE
            },

            set (key, val, options) {
                // Override Model.prototype.set to make sure that the
                // default `image` and `image_type` values are maintained.
                let attrs;
                if (typeof key === 'object') {
                    attrs = key;
                    options = val;
                } else {
                    (attrs = {})[key] = val;
                }
                if ('image' in attrs && !attrs['image']) {
                    attrs['image'] = _converse.DEFAULT_IMAGE;
                    attrs['image_type'] = _converse.DEFAULT_IMAGE_TYPE;
                    return Model.prototype.set.call(this, attrs, options);
                } else {
                    return Model.prototype.set.apply(this, arguments);
                }
            },

            getDisplayName () {
                return this.get('nickname') || this.get('fullname') || this.get('jid');
            }
        });


        _converse.VCards = Collection.extend({
            model: _converse.VCard,

            initialize () {
                this.on('add', vcard => (vcard.get('jid') && api.vcard.update(vcard)));
            }
        });


        async function onVCardData (jid, iq) {
            const vcard = iq.querySelector('vCard');
            let result = {};
            if (vcard !== null) {
                result = {
                    'stanza': iq,
                    'fullname': vcard.querySelector('FN')?.textContent,
                    'nickname': vcard.querySelector('NICKNAME')?.textContent,
                    'image': vcard.querySelector('PHOTO BINVAL')?.textContent,
                    'image_type': vcard.querySelector('PHOTO TYPE')?.textContent,
                    'url': vcard.querySelector('URL')?.textContent,
                    'role': vcard.querySelector('ROLE')?.textContent,
                    'email': vcard.querySelector('EMAIL USERID')?.textContent,
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
                iq = await api.sendIQ(createStanza("get", to))
            } catch (iq) {
                return {
                    'stanza': iq,
                    'jid': jid,
                    'vcard_error': (new Date()).toISOString()
                }
            }
            return onVCardData(jid, iq);
        }


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
            await api.waitUntil('VCardsInitialized');
            model.vcard = _converse.vcards.findWhere({'jid': jid});
            if (!model.vcard) {
                model.vcard = _converse.vcards.create({'jid': jid});
            }
            model.vcard.on('change', () => model.trigger('vcard:change'));
        }


        function getVCardForChatroomOccupant (message) {
            const chatbox = message?.collection?.chatbox;
            const nick = Strophe.getResourceFromJid(message.get('from'));

            if (chatbox && chatbox.get('nick') === nick) {
                return _converse.xmppstatus.vcard;
            } else {
                const jid = message.occupant && message.occupant.get('jid') || message.get('from');
                if (jid) {
                    return _converse.vcards.findWhere({jid}) || _converse.vcards.create({jid});
                } else {
                    log.error(`Could not assign VCard for message because no JID found! msgid: ${message.get('msgid')}`);
                    return;
                }
            }
        }


        async function setVCardOnMUCMessage (message) {
            await api.waitUntil('VCardsInitialized');
            if (['error', 'info'].includes(message.get('type'))) {
                return;
            } else {
                message.vcard = getVCardForChatroomOccupant(message);
            }
        }


        _converse.initVCardCollection = async function () {
            _converse.vcards = new _converse.VCards();
            const id = `${_converse.bare_jid}-converse.vcards`;
            initStorage(_converse.vcards, id);
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
            api.trigger('VCardsInitialized');
        }


        function clearVCardsSession () {
            if (_converse.shouldClearCache()) {
                api.promises.add('VCardsInitialized');
                if (_converse.vcards) {
                    _converse.vcards.clearStore();
                    delete _converse.vcards;
                }
            }
        }


        /************************ BEGIN Event Handlers ************************/

        api.listen.on('chatBoxInitialized', m => setVCardOnModel(m));
        api.listen.on('chatRoomInitialized', m => setVCardOnModel(m));
        api.listen.on('chatRoomMessageInitialized', m => setVCardOnMUCMessage(m));
        api.listen.on('addClientFeatures', () => api.disco.own.features.add(Strophe.NS.VCARD));
        api.listen.on('clearSession', () => clearVCardsSession());
        api.listen.on('messageInitialized', m => setVCardOnModel(m));
        api.listen.on('rosterContactInitialized', m => setVCardOnModel(m));
        api.listen.on('statusInitialized', _converse.initVCardCollection);


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
                 * Sends out an IQ stanza to set the user's VCard and if
                 * successful, it updates the {@link _converse.VCard}
                 * for the passed in JID.
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
                async set (jid, data) {
                    if (!jid) {
                        throw Error("No jid provided for the VCard data");
                    }
                    const div = document.createElement('div');
                    const vcard_el = u.toStanza(`
                        <vCard xmlns="vcard-temp">
                            <FN>${data.fn}</FN>
                            <NICKNAME>${data.nickname}</NICKNAME>
                            <URL>${data.url}</URL>
                            <ROLE>${data.role}</ROLE>
                            <EMAIL><INTERNET/><PREF/><USERID>${data.email}</USERID></EMAIL>
                            <PHOTO>
                                <TYPE>${data.image_type}</TYPE>
                                <BINVAL>${data.image}</BINVAL>
                            </PHOTO>
                        </vCard>`, div);
                    let result;
                    try {
                        result = await api.sendIQ(createStanza("set", jid, vcard_el));
                    } catch (e) {
                        throw (e);
                    }
                    await api.vcard.update(jid, true);
                    return result;
                },

                /**
                 * @method _converse.api.vcard.get
                 * @param {Model|string} model Either a `Model` instance, or a string JID.
                 *     If a `Model` instance is passed in, then it must have either a `jid`
                 *     attribute or a `muc_jid` attribute.
                 * @param {boolean} [force] A boolean indicating whether the vcard should be
                 *     fetched even if it's been fetched before.
                 * @returns {promise} A Promise which resolves with the VCard data for a particular JID or for
                 *     a `Model` instance which represents an entity with a JID (such as a roster contact,
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
                    if (typeof model === 'string') {
                        return getVCard(_converse, model);
                    } else if (force ||
                            !model.get('vcard_updated') ||
                            !dayjs(model.get('vcard_error')).isSame(new Date(), "day")) {

                        const jid = model.get('jid');
                        if (!jid) {
                            log.error("No JID to get vcard for");
                        }
                        return getVCard(_converse, jid);
                    } else {
                        return Promise.resolve({});
                    }
                },

                /**
                 * Fetches the VCard associated with a particular `Model` instance
                 * (by using its `jid` or `muc_jid` attribute) and then updates the model with the
                 * returned VCard data.
                 *
                 * @method _converse.api.vcard.update
                 * @param {Model} model A `Model` instance
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
                    model = typeof model === 'string' ? _converse.vcards.findWhere({'jid': model}) : model;
                    if (!model) {
                        log.error(`Could not find a VCard model for ${model}`);
                        return;
                    }
                    delete data['stanza']
                    model.save(data);
                }
            }
        });
    }
});
