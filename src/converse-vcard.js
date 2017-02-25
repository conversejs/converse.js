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
    var Strophe = converse.env.Strophe,
        $ = converse.env.jQuery,
        _ = converse.env._,
        moment = converse.env.moment;

    converse.plugins.add('converse-vcard', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            Features: {
                addClientFeatures: function () {
                    var _converse = this.__super__._converse;
                    this.__super__.addClientFeatures.apply(this, arguments);
                    if (_converse.use_vcards) {
                        _converse.connection.disco.addFeature(Strophe.NS.VCARD);
                    }
                }
            },

            RosterContacts: {
                createRequestingContact: function (presence) {
                    var _converse = this.__super__._converse;
                    var bare_jid = Strophe.getBareJidFromJid(presence.getAttribute('from'));
                    _converse.getVCard(
                        bare_jid,
                        _.partial(_converse.createRequestingContactFromVCard, presence),
                        function (iq, jid) {
                            _converse.log("Error while retrieving vcard for "+jid);
                            _converse.createRequestingContactFromVCard(presence, iq, jid);
                        }
                    );
                }
            }
        },


        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var _converse = this._converse;
            this.updateSettings({
                use_vcards: true,
            });

            _converse.createRequestingContactFromVCard = function (presence, iq, jid, fullname, img, img_type, url) {
                var bare_jid = Strophe.getBareJidFromJid(jid);
                var nick = $(presence).children('nick[xmlns="'+Strophe.NS.NICK+'"]').text();
                var user_data = {
                    jid: bare_jid,
                    subscription: 'none',
                    ask: null,
                    requesting: true,
                    fullname: fullname || nick || bare_jid,
                    image: img,
                    image_type: img_type,
                    url: url,
                    vcard_updated: moment().format()
                };
                _converse.roster.create(user_data);
                _converse.emit('contactRequest', user_data);
            };

            _converse.onVCardError = function (jid, iq, errback) {
                var contact = _converse.roster.get(jid);
                if (contact) {
                    contact.save({ 'vcard_updated': moment().format() });
                }
                if (errback) { errback(iq, jid); }
            };

            _converse.onVCardData = function (jid, iq, callback) {
                var $vcard = $(iq).find('vCard'),
                    fullname = $vcard.find('FN').text(),
                    img = $vcard.find('BINVAL').text(),
                    img_type = $vcard.find('TYPE').text(),
                    url = $vcard.find('URL').text();
                if (jid) {
                    var contact = _converse.roster.get(jid);
                    if (contact) {
                        fullname = _.isEmpty(fullname)? contact.get('fullname') || jid: fullname;
                        contact.save({
                            'fullname': fullname,
                            'image_type': img_type,
                            'image': img,
                            'url': url,
                            'vcard_updated': moment().format()
                        });
                    }
                }
                if (callback) {
                    callback(iq, jid, fullname, img, img_type, url);
                }
            };

            _converse.getVCard = function (jid, callback, errback) {
                /* Request the VCard of another user.
                 *
                 * Parameters:
                 *    (String) jid - The Jabber ID of the user whose VCard
                 *      is being requested.
                 *    (Function) callback - A function to call once the VCard is
                 *      returned.
                 *    (Function) errback - A function to call if an error occured
                 *      while trying to fetch the VCard.
                 */
                if (!_converse.use_vcards) {
                    if (callback) { callback(null, jid); }
                } else {
                    _converse.connection.vcard.get(
                        _.partial(_converse.onVCardData, jid, _, callback),
                        jid,
                        _.partial(_converse.onVCardError, jid, _, errback));
                }
            };

            var updateVCardForChatBox = function (chatbox) {
                if (!_converse.use_vcards) { return; }
                var jid = chatbox.model.get('jid'),
                    contact = _converse.roster.get(jid);
                if ((contact) && (!contact.get('vcard_updated'))) {
                    _converse.getVCard(
                        jid,
                        function (iq, jid, fullname, image, image_type, url) {
                            chatbox.model.save({
                                'fullname' : fullname || jid,
                                'url': url,
                                'image_type': image_type,
                                'image': image
                            });
                        },
                        function () {
                            _converse.log(
                                "updateVCardForChatBox: Error occured while fetching vcard"
                            );
                        }
                    );
                }
            };
            _converse.on('chatBoxInitialized', updateVCardForChatBox);


            var onContactAdd = function (contact) {
                if (!contact.get('vcard_updated')) {
                    // This will update the vcard, which triggers a change
                    // request which will rerender the roster contact.
                    _converse.getVCard(contact.get('jid'));
                }
            };
            _converse.on('initialized', function () {
                _converse.roster.on("add", onContactAdd);
            });

            var fetchOwnVCard = function () {
                if (_converse.xmppstatus.get('fullname') === undefined) {
                    _converse.getVCard(
                        null, // No 'to' attr when getting one's own vCard
                        function (iq, jid, fullname) {
                            _converse.xmppstatus.save({'fullname': fullname});
                        }
                    );
                }
            };
            _converse.on('statusInitialized', fetchOwnVCard);
        }
    });
}));
