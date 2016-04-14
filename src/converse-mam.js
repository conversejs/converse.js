// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

// XEP-0059 Result Set Management

(function (root, factory) {
    define("converse-mam", [
            "converse-core",
            "converse-api",
            "converse-chatview", // Could be made a soft dependency
            "converse-muc", // Could be made a soft dependency
            "strophe.rsm"
    ], factory);
}(this, function (converse, converse_api) {
    "use strict";
    var $ = converse_api.env.jQuery,
        Strophe = converse_api.env.Strophe,
        $iq = converse_api.env.$iq,
        _ = converse_api.env._,
        moment = converse_api.env.moment;

    var RSM_ATTRIBUTES = ['max', 'first', 'last', 'after', 'before', 'index', 'count'];
    // XEP-0313 Message Archive Management
    var MAM_ATTRIBUTES = ['with', 'start', 'end'];

    Strophe.addNamespace('MAM', 'urn:xmpp:mam:0');
    Strophe.addNamespace('RSM', 'http://jabber.org/protocol/rsm');


    converse_api.plugins.add('mam', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            Features: {
                addClientFeatures: function () {
                    converse.connection.disco.addFeature(Strophe.NS.MAM);
                    return this._super.addClientFeatures.apply(this, arguments);
                }
            },

            ChatBoxes: {
                createMessage: function ($message, $delay) {
                    var message = this._super.createMessage.apply(this, arguments);
                    message.save({
                        archive_id: $message.find('result[xmlns="'+Strophe.NS.MAM+'"]').attr('id')
                    });
                }
            },

            ChatBoxView: {
                render: function () {
                    var result = this._super.render.apply(this, arguments);
                    if (!this.disable_mam) {
                        this.$content.on('scroll', _.debounce(this.onScroll.bind(this), 100));
                    }
                    return result;
                },

                afterMessagesFetched: function () {
                    if (this.disable_mam || !converse.features.findWhere({'var': Strophe.NS.MAM})) {
                        return this._super.afterMessagesFetched.apply(this, arguments);
                    }
                    if (this.model.messages.length < converse.archived_messages_page_size) {
                        this.fetchArchivedMessages({
                            'before': '', // Page backwards from the most recent message
                            'with': this.model.get('jid'),
                            'max': converse.archived_messages_page_size
                        });
                    }
                    return this._super.afterMessagesFetched.apply(this, arguments);
                },

                fetchArchivedMessages: function (options) {
                    /* Fetch archived chat messages from the XMPP server.
                     *
                     * Then, upon receiving them, call onMessage on the chat box,
                     * so that they are displayed inside it.
                     */
                    if (!converse.features.findWhere({'var': Strophe.NS.MAM})) {
                        converse.log("Attempted to fetch archived messages but this user's server doesn't support XEP-0313");
                        return;
                    }
                    if (this.disable_mam) {
                        return;
                    }
                    this.addSpinner();
                    converse.queryForArchivedMessages(options, function (messages) {
                            this.clearSpinner();
                            if (messages.length) {
                                _.map(messages, converse.chatboxes.onMessage.bind(converse.chatboxes));
                            }
                        }.bind(this),
                        function () {
                            this.clearSpinner();
                            converse.log("Error or timeout while trying to fetch archived messages", "error");
                        }.bind(this)
                    );
                },

                onScroll: function (ev) {
                    if ($(ev.target).scrollTop() === 0 && this.model.messages.length) {
                        this.fetchArchivedMessages({
                            'before': this.model.messages.at(0).get('archive_id'),
                            'with': this.model.get('jid'),
                            'max': converse.archived_messages_page_size
                        });
                    }
                },
            },

            ChatRoomView: {
                render: function () {
                    var result = this._super.render.apply(this, arguments);
                    if (!this.disable_mam) {
                        this.$content.on('scroll', _.debounce(this.onScroll.bind(this), 100));
                    }
                    return result;
                },

            }

        },


        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            this.updateSettings({
                archived_messages_page_size: '20',
                message_archiving: 'never', // Supported values are 'always', 'never', 'roster' (https://xmpp.org/extensions/xep-0313.html#prefs)
                message_archiving_timeout: 8000, // Time (in milliseconds) to wait before aborting MAM request
            });

            converse.queryForArchivedMessages = function (options, callback, errback) {
                /* Do a MAM (XEP-0313) query for archived messages.
                 *
                 * Parameters:
                 *    (Object) options - Query parameters, either MAM-specific or also for Result Set Management.
                 *    (Function) callback - A function to call whenever we receive query-relevant stanza.
                 *    (Function) errback - A function to call when an error stanza is received.
                 *
                 * The options parameter can also be an instance of
                 * Strophe.RSM to enable easy querying between results pages.
                 *
                 * The callback function may be called multiple times, first
                 * for the initial IQ result and then for each message
                 * returned. The last time the callback is called, a
                 * Strophe.RSM object is returned on which "next" or "previous"
                 * can be called before passing it in again to this method, to
                 * get the next or previous page in the result set.
                 */
                var date, messages = [];
                if (typeof options === "function") {
                    callback = options;
                    errback = callback;
                }
                if (!converse.features.findWhere({'var': Strophe.NS.MAM})) {
                    converse.log('This server does not support XEP-0313, Message Archive Management');
                    errback(null);
                    return;
                }
                var queryid = converse.connection.getUniqueId();
                var attrs = {'type':'set'};
                if (typeof options !== "undefined" && options.groupchat) {
                    if (!options['with']) {
                        throw new Error('You need to specify a "with" value containing the chat room JID, when querying groupchat messages.');
                    }
                    attrs.to = options['with'];
                }
                var stanza = $iq(attrs).c('query', {'xmlns':Strophe.NS.MAM, 'queryid':queryid});
                if (typeof options !== "undefined") {
                    stanza.c('x', {'xmlns':Strophe.NS.XFORM, 'type': 'submit'})
                            .c('field', {'var':'FORM_TYPE', 'type': 'hidden'})
                            .c('value').t(Strophe.NS.MAM).up().up();

                    if (options['with'] && !options.groupchat) {
                        stanza.c('field', {'var':'with'}).c('value').t(options['with']).up().up();
                    }
                    _.each(['start', 'end'], function (t) {
                        if (options[t]) {
                            date = moment(options[t]);
                            if (date.isValid()) {
                                stanza.c('field', {'var':t}).c('value').t(date.format()).up().up();
                            } else {
                                throw new TypeError('archive.query: invalid date provided for: '+t);
                            }
                        }
                    });
                    stanza.up();
                    if (options instanceof Strophe.RSM) {
                        stanza.cnode(options.toXML());
                    } else if (_.intersection(RSM_ATTRIBUTES, _.keys(options)).length) {
                        stanza.cnode(new Strophe.RSM(options).toXML());
                    }
                }
                converse.connection.addHandler(function (message) {
                    var $msg = $(message), $fin, rsm;
                    if (typeof callback === "function") {
                        $fin = $msg.find('fin[xmlns="'+Strophe.NS.MAM+'"]');
                        if ($fin.length) {
                            rsm = new Strophe.RSM({xml: $fin.find('set')[0]});
                            _.extend(rsm, _.pick(options, ['max']));
                            _.extend(rsm, _.pick(options, MAM_ATTRIBUTES));
                            callback(messages, rsm);
                            return false; // We've received all messages, decommission this handler
                        } else if (queryid === $msg.find('result').attr('queryid')) {
                            messages.push(message);
                        }
                        return true;
                    } else {
                        return false; // There's no callback, so no use in continuing this handler.
                    }
                }, Strophe.NS.MAM);
                converse.connection.sendIQ(stanza, null, errback, converse.message_archiving_timeout);
            };

            _.extend(converse_api, {
                /* Extend default converse.js API to add methods specific to MAM
                 */
                'archive': {
                    'query': converse.queryForArchivedMessages.bind(converse)
                }
            });

            converse.onMAMError = function (iq) {
                if ($(iq).find('feature-not-implemented').length) {
                    converse.log("Message Archive Management (XEP-0313) not supported by this browser");
                } else {
                    converse.log("An error occured while trying to set archiving preferences.");
                    converse.log(iq);
                }
            };

            converse.onMAMPreferences = function (feature, iq) {
                /* Handle returned IQ stanza containing Message Archive
                 * Management (XEP-0313) preferences.
                 *
                 * XXX: For now we only handle the global default preference.
                 * The XEP also provides for per-JID preferences, which is
                 * currently not supported in converse.js.
                 *
                 * Per JID preferences will be set in chat boxes, so it'll
                 * probbaly be handled elsewhere in any case.
                 */
                var $prefs = $(iq).find('prefs[xmlns="'+Strophe.NS.MAM+'"]');
                var default_pref = $prefs.attr('default');
                var stanza;
                if (default_pref !== converse.message_archiving) {
                    stanza = $iq({'type': 'set'}).c('prefs', {'xmlns':Strophe.NS.MAM, 'default':converse.message_archiving});
                    $prefs.children().each(function (idx, child) {
                        stanza.cnode(child).up();
                    });
                    converse.connection.sendIQ(stanza, _.partial(function (feature, iq) {
                            // XXX: Strictly speaking, the server should respond with the updated prefs
                            // (see example 18: https://xmpp.org/extensions/xep-0313.html#config)
                            // but Prosody doesn't do this, so we don't rely on it.
                            feature.save({'preferences': {'default':converse.message_archiving}});
                        }, feature),
                        converse.onMAMError
                    );
                } else {
                    feature.save({'preferences': {'default':converse.message_archiving}});
                }
            };


            var onFeatureAdded = function (evt, feature) {
                var prefs = feature.get('preferences') || {};
                if (feature.get('var') === Strophe.NS.MAM && prefs['default'] !== converse.message_archiving) {
                    // Ask the server for archiving preferences
                    converse.connection.sendIQ(
                        $iq({'type': 'get'}).c('prefs', {'xmlns': Strophe.NS.MAM}),
                        _.partial(converse.onMAMPreferences, feature),
                        _.partial(converse.onMAMError, feature)
                    );
                }
            };
            converse.on('serviceDiscovered', onFeatureAdded.bind(converse.features));
        }
    });
}));
