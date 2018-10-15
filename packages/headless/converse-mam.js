// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

// XEP-0059 Result Set Management

(function (root, factory) {
    define(["sizzle",
            "converse-core",
            "converse-disco",
            "strophe.rsm"
    ], factory);
}(this, function (sizzle, converse) {
    "use strict";
    const CHATROOMS_TYPE = 'chatroom';
    const { Promise, Strophe, $iq, _, moment } = converse.env;
    const u = converse.env.utils;

    const RSM_ATTRIBUTES = ['max', 'first', 'last', 'after', 'before', 'index', 'count'];
    // XEP-0313 Message Archive Management
    const MAM_ATTRIBUTES = ['with', 'start', 'end'];


    function getMessageArchiveID (stanza) {
        // See https://xmpp.org/extensions/xep-0313.html#results
        //
        // The result messages MUST contain a <result/> element with an 'id'
        // attribute that gives the current message's archive UID
        const result = sizzle(`result[xmlns="${Strophe.NS.MAM}"]`, stanza).pop();
        if (!_.isUndefined(result)) {
            return result.getAttribute('id');
        }
        // See: https://xmpp.org/extensions/xep-0313.html#archives_id
        const stanza_id = sizzle(`stanza-id[xmlns="${Strophe.NS.SID}"]`, stanza).pop();
        if (!_.isUndefined(stanza_id)) {
            return stanza_id.getAttribute('id');
        }
    }

    function queryForArchivedMessages (_converse, options, callback, errback) {
        /* Internal function, called by the "archive.query" API method.
         */
        let date;
        if (_.isFunction(options)) {
            callback = options;
            errback = callback;
            options = null;
        }
        const queryid = _converse.connection.getUniqueId();
        const attrs = {'type':'set'};
        if (options && options.groupchat) {
            if (!options['with']) { // eslint-disable-line dot-notation
                throw new Error(
                    'You need to specify a "with" value containing '+
                    'the chat room JID, when querying groupchat messages.');
            }
            attrs.to = options['with']; // eslint-disable-line dot-notation
        }

        const stanza = $iq(attrs).c('query', {'xmlns':Strophe.NS.MAM, 'queryid':queryid});
        if (options) {
            stanza.c('x', {'xmlns':Strophe.NS.XFORM, 'type': 'submit'})
                    .c('field', {'var':'FORM_TYPE', 'type': 'hidden'})
                    .c('value').t(Strophe.NS.MAM).up().up();

            if (options['with'] && !options.groupchat) {  // eslint-disable-line dot-notation
                stanza.c('field', {'var':'with'}).c('value')
                    .t(options['with']).up().up(); // eslint-disable-line dot-notation
            }
            _.each(['start', 'end'], function (t) {
                if (options[t]) {
                    date = moment(options[t]);
                    if (date.isValid()) {
                        stanza.c('field', {'var':t}).c('value').t(date.format()).up().up();
                    } else {
                        throw new TypeError(`archive.query: invalid date provided for: ${t}`);
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

        const messages = [];
        const message_handler = _converse.connection.addHandler((message) => {
            if (options.groupchat && message.getAttribute('from') !== options['with']) { // eslint-disable-line dot-notation
                return true;
            }
            const result = message.querySelector('result');
            if (!_.isNull(result) && result.getAttribute('queryid') === queryid) {
                messages.push(message);
            }
            return true;
        }, Strophe.NS.MAM);

        _converse.connection.sendIQ(
            stanza,
            function (iq) {
                _converse.connection.deleteHandler(message_handler);
                if (_.isFunction(callback)) {
                    const set = iq.querySelector('set');
                    let rsm;
                    if (!_.isUndefined(set)) {
                        rsm = new Strophe.RSM({xml: set});
                        _.extend(rsm, _.pick(options, _.concat(MAM_ATTRIBUTES, ['max'])));
                    }
                    callback(messages, rsm);
                }
            },
            function () {
                _converse.connection.deleteHandler(message_handler);
                if (_.isFunction(errback)) { errback.apply(this, arguments); }
            },
            _converse.message_archiving_timeout
        );
    }


    converse.plugins.add('converse-mam', {

        dependencies: ['converse-chatview', 'converse-muc', 'converse-muc-views'],

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.
            ChatBox: {

                getMessageAttributesFromStanza (message, original_stanza) {
                    function _process (attrs) {
                        const archive_id = getMessageArchiveID(original_stanza);
                        if (archive_id) {
                            attrs.archive_id = archive_id;
                        }
                        return attrs;
                    }
                    const result = this.__super__.getMessageAttributesFromStanza.apply(this, arguments)
                    if (result instanceof Promise) {
                        return new Promise((resolve, reject) => result.then((attrs) => resolve(_process(attrs))).catch(reject));
                    } else {
                        return _process(result);
                    }
                }
            },

            ChatBoxView: {
                render () {
                    const result = this.__super__.render.apply(this, arguments);
                    if (!this.disable_mam) {
                        this.content.addEventListener('scroll', _.debounce(this.onScroll.bind(this), 100));
                    }
                    return result;
                },

                fetchNewestMessages () {
                    /* Fetches messages that might have been archived *after*
                     * the last archived message in our local cache.
                     */
                    if (this.disable_mam) { return; }
                    const { _converse } = this.__super__,
                          most_recent_msg = u.getMostRecentMessage(this.model);

                    if (_.isNil(most_recent_msg)) {
                        this.fetchArchivedMessages();
                    } else {
                        const archive_id = most_recent_msg.get('archive_id');
                        if (archive_id) {
                            this.fetchArchivedMessages({
                                'after': most_recent_msg.get('archive_id')
                            });
                        } else {
                            this.fetchArchivedMessages({
                                'start': most_recent_msg.get('time')
                            });
                        }
                    }
                },

                fetchArchivedMessagesIfNecessary () {
                    /* Check if archived messages should be fetched, and if so, do so. */
                    if (this.disable_mam || this.model.get('mam_initialized')) {
                        return;
                    }
                    const { _converse } = this.__super__;
                    _converse.api.disco.supports(Strophe.NS.MAM, _converse.bare_jid).then(
                        (result) => { // Success
                            if (result.length) {
                                this.fetchArchivedMessages();
                            }
                            this.model.save({'mam_initialized': true});
                        },
                        () => { // Error
                            _converse.log(
                                "Error or timeout while checking for MAM support",
                                Strophe.LogLevel.ERROR
                            );
                        }
                    ).catch((msg) => {
                        this.clearSpinner();
                        _converse.log(msg, Strophe.LogLevel.FATAL);
                    });
                },

                fetchArchivedMessages (options) {
                    const { _converse } = this.__super__;
                    if (this.disable_mam) { return; }

                    const is_groupchat = this.model.get('type') === CHATROOMS_TYPE;

                    let mam_jid, message_handler;
                    if (is_groupchat) {
                        mam_jid = this.model.get('jid');
                        message_handler = this.model.onMessage.bind(this.model);
                    } else {
                        mam_jid = _converse.bare_jid;
                        message_handler = _converse.chatboxes.onMessage.bind(_converse.chatboxes)
                    }

                    _converse.api.disco.supports(Strophe.NS.MAM, mam_jid).then(
                        (results) => { // Success
                            if (!results.length) { return; }
                            this.addSpinner();
                            _converse.api.archive.query(
                                _.extend({
                                    'groupchat': is_groupchat,
                                    'before': '', // Page backwards from the most recent message
                                    'max': _converse.archived_messages_page_size,
                                    'with': this.model.get('jid'),
                                }, options),
                                (messages) => { // Success
                                    this.clearSpinner();
                                    _.each(messages, message_handler);
                                },
                                () => { // Error
                                    this.clearSpinner();
                                    _converse.log(
                                        "Error or timeout while trying to fetch "+
                                        "archived messages", Strophe.LogLevel.ERROR);
                                }
                            );
                        },
                        () => { // Error
                            _converse.log(
                                "Error or timeout while checking for MAM support",
                                Strophe.LogLevel.ERROR
                            );
                        }
                    ).catch((msg) => {
                        this.clearSpinner();
                        _converse.log(msg, Strophe.LogLevel.FATAL);
                    });
                },

                onScroll (ev) {
                    const { _converse } = this.__super__;
                    if (this.content.scrollTop === 0 && this.model.messages.length) {
                        const oldest_message = this.model.messages.at(0);
                        const archive_id = oldest_message.get('archive_id');
                        if (archive_id) {
                            this.fetchArchivedMessages({
                                'before': archive_id
                            });
                        } else {
                            this.fetchArchivedMessages({
                                'end': oldest_message.get('time')
                            });
                        }
                    }
                },
            },

            ChatRoom: {

                isDuplicate (message, original_stanza) {
                    const result = this.__super__.isDuplicate.apply(this, arguments);
                    if (result) {
                        return result;
                    }
                    const archive_id = getMessageArchiveID(original_stanza);
                    if (archive_id) {
                        return this.messages.filter({'archive_id': archive_id}).length > 0;
                    }
                }
            },

            ChatRoomView: {

                initialize () {
                    const { _converse } = this.__super__;
                    this.__super__.initialize.apply(this, arguments);
                    this.model.on('change:mam_enabled', this.fetchArchivedMessagesIfNecessary, this);
                    this.model.on('change:connection_status', this.fetchArchivedMessagesIfNecessary, this);
                },

                renderChatArea () {
                    const result = this.__super__.renderChatArea.apply(this, arguments);
                    if (!this.disable_mam) {
                        this.content.addEventListener('scroll', _.debounce(this.onScroll.bind(this), 100));
                    }
                    return result;
                },

                fetchArchivedMessagesIfNecessary () {
                    if (this.model.get('connection_status') !== converse.ROOMSTATUS.ENTERED ||
                        !this.model.get('mam_enabled') ||
                        this.model.get('mam_initialized')) {

                        return;
                    }
                    this.fetchArchivedMessages();
                    this.model.save({'mam_initialized': true});
                }
            }
        },

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by Converse.js's plugin machinery.
             */
            const { _converse } = this;

            _converse.api.settings.update({
                archived_messages_page_size: '50',
                message_archiving: undefined, // Supported values are 'always', 'never', 'roster' (https://xmpp.org/extensions/xep-0313.html#prefs)
                message_archiving_timeout: 8000, // Time (in milliseconds) to wait before aborting MAM request
            });

            _converse.onMAMError = function (model, iq) {
                if (iq.querySelectorAll('feature-not-implemented').length) {
                    _converse.log(
                        "Message Archive Management (XEP-0313) not supported by this server",
                        Strophe.LogLevel.WARN);
                } else {
                    _converse.log(
                        "An error occured while trying to set archiving preferences.",
                        Strophe.LogLevel.ERROR);
                    _converse.log(iq);
                }
            };

            _converse.onMAMPreferences = function (feature, iq) {
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
                const preference = sizzle(`prefs[xmlns="${Strophe.NS.MAM}"]`, iq).pop();
                const default_pref = preference.getAttribute('default');
                if (default_pref !== _converse.message_archiving) {
                    const stanza = $iq({'type': 'set'})
                        .c('prefs', {
                            'xmlns':Strophe.NS.MAM,
                            'default':_converse.message_archiving
                        });
                    _.each(preference.children, function (child) {
                        stanza.cnode(child).up();
                    });
                    _converse.connection.sendIQ(stanza, _.partial(function (feature, iq) {
                            // XXX: Strictly speaking, the server should respond with the updated prefs
                            // (see example 18: https://xmpp.org/extensions/xep-0313.html#config)
                            // but Prosody doesn't do this, so we don't rely on it.
                            feature.save({'preferences': {'default':_converse.message_archiving}});
                        }, feature),
                        _converse.onMAMError
                    );
                } else {
                    feature.save({'preferences': {'default':_converse.message_archiving}});
                }
            };

            /* Event handlers */
            _converse.on('serviceDiscovered', (feature) => {
                const prefs = feature.get('preferences') || {};
                if (feature.get('var') === Strophe.NS.MAM &&
                        prefs['default'] !== _converse.message_archiving && // eslint-disable-line dot-notation
                        !_.isUndefined(_converse.message_archiving) ) {
                    // Ask the server for archiving preferences
                    _converse.connection.sendIQ(
                        $iq({'type': 'get'}).c('prefs', {'xmlns': Strophe.NS.MAM}),
                        _.partial(_converse.onMAMPreferences, feature),
                        _.partial(_converse.onMAMError, feature)
                    );
                }
            });

            _converse.on('addClientFeatures', () => {
                _converse.api.disco.own.features.add(Strophe.NS.MAM);
            });

            _converse.on('afterMessagesFetched', (chatboxview) => {
                chatboxview.fetchNewestMessages();
            });

            _converse.on('reconnected', () => {
                const private_chats = _converse.chatboxviews.filter(
                    (view) => _.at(view, 'model.attributes.type')[0] === 'chatbox'
                );
                _.each(private_chats, (view) => view.fetchNewestMessages())
            });

            _.extend(_converse.api, {
                /**
                 * The [XEP-0313](https://xmpp.org/extensions/xep-0313.html) Message Archive Management API
                 *
                 * Enables you to query an XMPP server for archived messages.
                 *
                 * See also the [message-archiving](/docs/html/configuration.html#message-archiving)
                 * option in the configuration settings section, which you'll
                 * usually want to use in conjunction with this API.
                 *
                 * @namespace _converse.api.archive
                 * @memberOf _converse.api
                 */
                'archive': {
                     /**
                      * Query for archived messages.
                      *
                      * The options parameter can also be an instance of
                      * Strophe.RSM to enable easy querying between results pages.
                      *
                      * @method _converse.api.archive.query
                      * @param {(Object|Strophe.RSM)} options Query parameters, either
                      *      MAM-specific or also for Result Set Management.
                      *      Can be either an object or an instance of Strophe.RSM.
                      *      Valid query parameters are:
                      * * `with`
                      * * `start`
                      * * `end`
                      * * `first`
                      * * `last`
                      * * `after`
                      * * `before`
                      * * `index`
                      * * `count`
                      * @param {Function} callback A function to call whenever
                      *      we receive query-relevant stanza.
                      *      When the callback is called, a Strophe.RSM object is
                      *      returned on which "next" or "previous" can be called
                      *      before passing it in again to this method, to
                      *      get the next or previous page in the result set.
                      * @param {Function} errback A function to call when an
                      *      error stanza is received, for example when it
                      *      doesn't support message archiving.
                      *
                      * @example
                      * // Requesting all archived messages
                      * // ================================
                      * //
                      * // The simplest query that can be made is to simply not pass in any parameters.
                      * // Such a query will return all archived messages for the current user.
                      * //
                      * // Generally, you'll however always want to pass in a callback method, to receive
                      * // the returned messages.
                      *
                      * this._converse.api.archive.query(
                      *     (messages) => {
                      *         // Do something with the messages, like showing them in your webpage.
                      *     },
                      *     (iq) => {
                      *         // The query was not successful, perhaps inform the user?
                      *         // The IQ stanza returned by the XMPP server is passed in, so that you
                      *         // may inspect it and determine what the problem was.
                      *     }
                      * )
                      * @example
                      * // Waiting until server support has been determined
                      * // ================================================
                      * //
                      * // The query method will only work if Converse has been able to determine that
                      * // the server supports MAM queries, otherwise the following error will be raised:
                      * //
                      * // "This server does not support XEP-0313, Message Archive Management"
                      * //
                      * // The very first time Converse loads in a browser tab, if you call the query
                      * // API too quickly, the above error might appear because service discovery has not
                      * // yet been completed.
                      * //
                      * // To work solve this problem, you can first listen for the `serviceDiscovered` event,
                      * // through which you can be informed once support for MAM has been determined.
                      *
                      *  _converse.api.listen.on('serviceDiscovered', function (feature) {
                      *      if (feature.get('var') === converse.env.Strophe.NS.MAM) {
                      *          _converse.api.archive.query()
                      *      }
                      *  });
                      *
                      * @example
                      * // Requesting all archived messages for a particular contact or room
                      * // =================================================================
                      * //
                      * // To query for messages sent between the current user and another user or room,
                      * // the query options need to contain the the JID (Jabber ID) of the user or
                      * // room under the  `with` key.
                      *
                      * // For a particular user
                      * this._converse.api.archive.query({'with': 'john@doe.net'}, callback, errback);)
                      *
                      * // For a particular room
                      * this._converse.api.archive.query({'with': 'discuss@conference.doglovers.net'}, callback, errback);)
                      *
                      * @example
                      * // Requesting all archived messages before or after a certain date
                      * // ===============================================================
                      * //
                      * // The `start` and `end` parameters are used to query for messages
                      * // within a certain timeframe. The passed in date values may either be ISO8601
                      * // formatted date strings, or JavaScript Date objects.
                      *
                      *  const options = {
                      *      'with': 'john@doe.net',
                      *      'start': '2010-06-07T00:00:00Z',
                      *      'end': '2010-07-07T13:23:54Z'
                      *  };
                      *  this._converse.api.archive.query(options, callback, errback);
                      *
                      * @example
                      * // Limiting the amount of messages returned
                      * // ========================================
                      * //
                      * // The amount of returned messages may be limited with the `max` parameter.
                      * // By default, the messages are returned from oldest to newest.
                      *
                      * // Return maximum 10 archived messages
                      * this._converse.api.archive.query({'with': 'john@doe.net', 'max':10}, callback, errback);
                      *
                      * @example
                      * // Paging forwards through a set of archived messages
                      * // ==================================================
                      * //
                      * // When limiting the amount of messages returned per query, you might want to
                      * // repeatedly make a further query to fetch the next batch of messages.
                      * //
                      * // To simplify this usecase for you, the callback method receives not only an array
                      * // with the returned archived messages, but also a special RSM (*Result Set
                      * // Management*) object which contains the query parameters you passed in, as well
                      * // as two utility methods `next`, and `previous`.
                      * //
                      * // When you call one of these utility methods on the returned RSM object, and then
                      * // pass the result into a new query, you'll receive the next or previous batch of
                      * // archived messages. Please note, when calling these methods, pass in an integer
                      * // to limit your results.
                      *
                      * const callback = function (messages, rsm) {
                      *     // Do something with the messages, like showing them in your webpage.
                      *     // ...
                      *     // You can now use the returned "rsm" object, to fetch the next batch of messages:
                      *     _converse.api.archive.query(rsm.next(10), callback, errback))
                      *
                      * }
                      * _converse.api.archive.query({'with': 'john@doe.net', 'max':10}, callback, errback);
                      *
                      * @example
                      * // Paging backwards through a set of archived messages
                      * // ===================================================
                      * //
                      * // To page backwards through the archive, you need to know the UID of the message
                      * // which you'd like to page backwards from and then pass that as value for the
                      * // `before` parameter. If you simply want to page backwards from the most recent
                      * // message, pass in the `before` parameter with an empty string value `''`.
                      *
                      * _converse.api.archive.query({'before': '', 'max':5}, function (message, rsm) {
                      *     // Do something with the messages, like showing them in your webpage.
                      *     // ...
                      *     // You can now use the returned "rsm" object, to fetch the previous batch of messages:
                      *     rsm.previous(5); // Call previous method, to update the object's parameters,
                      *                      // passing in a limit value of 5.
                      *     // Now we query again, to get the previous batch.
                      *     _converse.api.archive.query(rsm, callback, errback);
                      * }
                      */
                    'query': function (options, callback, errback) {
                        if (!_converse.api.connection.connected()) {
                            throw new Error('Can\'t call `api.archive.query` before having established an XMPP session');
                        }
                        return queryForArchivedMessages(_converse, options, callback, errback);
                    }
                }
            });
        }
    });
}));
