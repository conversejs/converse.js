// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

(function (root, factory) {
    define(["converse-core", "strophe.vcard"], factory);
}(this, function (converse) {
    "use strict";
    const { Promise, Strophe, _, moment, sizzle } = converse.env;
    const u = converse.env.utils;


    function onVCardData (_converse, jid, iq, callback) {
        const vcard = iq.querySelector('vCard');
        if (_.isNull(vcard)) {
            // Some servers return an empty IQ
            return onVCardError(_converse, jid, iq, callback);
        }
        const img_type = _.get(vcard.querySelector('TYPE'), 'textContent'),
            img = _.get(vcard.querySelector('BINVAL'), 'textContent'),
            url = _.get(vcard.querySelector('URL'), 'textContent'),
            fullname = _.get(vcard.querySelector('FN'), 'textContent');

        if (!u.isSameBareJID(jid, _converse.bare_jid)) {
            const contact = _converse.roster.get(jid);
            if (contact) {
                contact.save({
                    'fullname': fullname || _.get(contact, 'fullname', jid),
                    'image_type': img_type,
                    'image': img,
                    'url': url,
                    'vcard_updated': moment().format()
                });
            }
        }
        if (callback) {
            callback({
                'stanza': iq,
                'fullname': fullname,
                'image': img,
                'image_type': img_type,
                'url': url
            });
        }
    }

    function onVCardError (_converse, jid, iq, errback) {
        const contact = _converse.roster.get(jid);
        if (contact) {
            contact.save({'vcard_updated': moment().format() });
        }
        if (errback) { errback({'stanza': iq, 'jid': jid}); }
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
            if (!_converse.use_vcards) {
                if (resolve) { resolve({'jid': jid}); }
            } else {
                _converse.connection.vcard.get(
                    _.partial(onVCardData, _converse, jid, _, resolve),
                    to,
                    _.partial(onVCardError, _converse, jid, _, resolve)
                );
            }
        });
    }

    function updateChatBoxFromVCard (_converse, jid) {
        _converse.api.vcard.get(jid)
            .then((vcard) => {
                const chatbox = _converse.chatboxes.getChatBox(jid);
                if (!_.isUndefined(chatbox)) {
                    chatbox.save(_.pick(vcard, ['fullname', 'url', 'image_type', 'image', 'vcard_updated']));
                }
            })
            .catch((e) => {
                _converse.log(e, Strophe.LogLevel.ERROR);
                _converse.log(
                    "updateChatBoxFromVCard: Error occured while attempting to update chatbox with VCard data",
                    Strophe.LogLevel.ERROR
                );
            });
    }


    converse.plugins.add('converse-vcard', {

        enabled (_converse) {
            _converse.api.settings.update({'use_vcards': true});
            return _converse.use_vcards;
        },

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            RosterContacts: {
                createRequestingContact (presence) {
                    const { _converse } = this.__super__;
                    const bare_jid = Strophe.getBareJidFromJid(presence.getAttribute('from'));

                    _converse.api.vcard.get(bare_jid)
                        .then(_.partial(_converse.createRequestingContactFromVCard, presence))
                        .catch((vcard) => {
                            _converse.log(
                                `Error while retrieving vcard for ${vcard.jid}`,
                                Strophe.LogLevel.WARN);
                            _converse.createRequestingContactFromVCard(presence, vcard.stanza, vcard.jid);
                        });
                }
            }
        },

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this;

            _converse.createRequestingContactFromVCard = function (presence, vcard) {
                const bare_jid = Strophe.getBareJidFromJid(presence.getAttribute('from'));
                let fullname = vcard.fullname;
                if (!fullname) {
                    const nick_el = sizzle(`nick[xmlns="${Strophe.NS.NICK}"]`, presence);
                    fullname = nick_el.length ? nick_el[0].textContent : bare_jid;
                }
                const user_data = {
                    'jid': bare_jid,
                    'subscription': 'none',
                    'ask': null,
                    'requesting': true,
                    'fullname': fullname,
                    'image': vcard.image,
                    'image_type': vcard.image_type,
                    'url': vcard.url,
                    'vcard_updated': moment().format()
                };
                _converse.roster.create(user_data);
                _converse.emit('contactRequest', user_data);
            };

            /* Event handlers */
            _converse.on('addClientFeatures', () => {
                _converse.connection.disco.addFeature(Strophe.NS.VCARD);
            });

            _converse.on('chatBoxInitialized', (chatbox) => {
                if (!_converse.use_vcards || chatbox.model.get('type') === 'headline') {
                    return;
                }
                _converse.api.waitUntil('rosterInitialized').then(() => {
                    const jid = chatbox.model.get('jid'),
                        contact = _converse.roster.get(jid);
                    if (contact && !contact.get('vcard_updated') ||
                        _.isUndefined(contact) && _converse.allow_non_roster_messaging) {

                        updateChatBoxFromVCard(_converse, jid);
                    }
                }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
            });

            _converse.on('initialized', () => {
                _converse.roster.on("add", (contact) => {
                    if (!contact.get('vcard_updated')) {
                        _converse.api.vcard.get(contact.get('jid'));
                    }
                });
            });

            _converse.on('statusInitialized', function fetchOwnVCard () {
                if (_.isNil(_converse.xmppstatus.get('vcard_updated'))) {
                    _converse.api.disco.supports(Strophe.NS.VCARD, _converse.domain)
                        .then((result) => {
                            if (result.length) {
                                _converse.api.vcard.get(_converse.bare_jid)
                                    .then((vcard) => _converse.xmppstatus.save(vcard));
                            }})
                        .catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                }
            });

            _.extend(_converse.api, {
                'vcard': {
                    'get' (jid) {
                        return getVCard(_converse, jid);
                    }
                }
            });
        }
    });
}));
