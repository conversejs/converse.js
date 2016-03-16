// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

(function (root, factory) {
    define("converse-vcard", [
            "converse-core",
            "converse-api",
            "strophe.vcard",
    ], factory);
}(this, function (converse, converse_api) {
    "use strict";
    var Strophe = converse_api.env.Strophe,
        $ = converse_api.env.jQuery,
        _ = converse_api.env._,
        moment = converse_api.env.moment;


    converse_api.plugins.add('vcard', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            Features: {
                addClientFeatures: function () {
                    this._super.addClientFeatures.apply(this, arguments);
                    if (converse.use_vcards) {
                        converse.connection.disco.addFeature(Strophe.NS.VCARD);
                    }
                }
            },

            RosterContacts: {
                createRequestingContact: function (presence) {
                    var bare_jid = Strophe.getBareJidFromJid(presence.getAttribute('from'));
                    converse.getVCard(
                        bare_jid,
                        _.partial(converse.createRequestingContactFromVCard, presence),
                        function (iq, jid) {
                            converse.log("Error while retrieving vcard for "+jid);
                            converse.createRequestingContactFromVCard(presence, iq, jid);
                        }
                    );
                }
            }
        },


        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            this.updateSettings({
                use_vcards: true,
            });

            converse.createRequestingContactFromVCard = function (presence, iq, jid, fullname, img, img_type, url) {
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
                converse.roster.create(user_data);
                converse.emit('contactRequest', user_data);
            };

            converse.onVCardError = function (jid, iq, errback) {
                var contact = converse.roster.get(jid);
                if (contact) {
                    contact.save({ 'vcard_updated': moment().format() });
                }
                if (errback) { errback(iq, jid); }
            };

            converse.onVCardData = function (jid, iq, callback) {
                var $vcard = $(iq).find('vCard'),
                    fullname = $vcard.find('FN').text(),
                    img = $vcard.find('BINVAL').text(),
                    img_type = $vcard.find('TYPE').text(),
                    url = $vcard.find('URL').text();
                if (jid) {
                    var contact = converse.roster.get(jid);
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

            converse.getVCard = function (jid, callback, errback) {
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
                if (!converse.use_vcards) {
                    if (callback) { callback(null, jid); }
                } else {
                    converse.connection.vcard.get(
                        _.partial(converse.onVCardData, jid, _, callback),
                        jid,
                        _.partial(converse.onVCardError, jid, _, errback));
                }
            };

            var updateVCardForChatBox = function (evt, chatbox) {
                if (!converse.use_vcards) { return; }
                var jid = chatbox.model.get('jid'),
                    contact = converse.roster.get(jid);
                if ((contact) && (!contact.get('vcard_updated'))) {
                    converse.getVCard(
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
                            converse.log(
                                "updateVCardForChatBox: Error occured while fetching vcard"
                            );
                        }
                    );
                }
            };
            converse.on('chatBoxInitialized', updateVCardForChatBox);


            var onContactAdd = function (contact) {
                if (!contact.get('vcard_updated')) {
                    // This will update the vcard, which triggers a change
                    // request which will rerender the roster contact.
                    converse.getVCard(contact.get('jid'));
                }
            };
            converse.on('initialized', function () {
                converse.roster.on("add", onContactAdd);
            });

            var fetchOwnVCard = function () {
                if (converse.xmppstatus.get('fullname') === undefined) {
                    converse.getVCard(
                        null, // No 'to' attr when getting one's own vCard
                        function (iq, jid, fullname) {
                            converse.xmppstatus.save({'fullname': fullname});
                        }
                    );
                }
            };
            converse.on('statusInitialized', fetchOwnVCard);
        }
    });
}));
