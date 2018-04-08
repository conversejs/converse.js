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
            "utils",
            "converse-disco",
            "strophe.rsm"
    ], factory);
}(this, function (sizzle, converse, utils) {
    "use strict";
    const CHATROOMS_TYPE = 'chatroom';
    const { Promise, Strophe, $iq, _, moment } = converse.env;

    const RSM_ATTRIBUTES = ['max', 'first', 'last', 'after', 'before', 'index', 'count'];
    // XEP-0313 Message Archive Management
    const MAM_ATTRIBUTES = ['with', 'start', 'end'];


    function getMessageArchiveID (stanza) {
        const result = sizzle(`result[xmlns="${Strophe.NS.MAM}"]`, stanza).pop();
        if (!_.isUndefined(result)) {
            return result.getAttribute('id');
        }
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
        }
        const queryid = _converse.connection.getUniqueId();
        const attrs = {'type':'set'};
        if (!_.isUndefined(options) && options.groupchat) {
            if (!options['with']) { // eslint-disable-line dot-notation
                throw new Error(
                    'You need to specify a "with" value containing '+
                    'the chat room JID, when querying groupchat messages.');
            }
            attrs.to = options['with']; // eslint-disable-line dot-notation
        }
        const stanza = $iq(attrs).c('query', {'xmlns':Strophe.NS.MAM, 'queryid':queryid});
        if (!_.isUndefined(options)) {
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
                getMessageAttributes (message, delay, original_stanza) {
                    const attrs = this.__super__.getMessageAttributes.apply(this, arguments);
                    const archive_id = getMessageArchiveID(original_stanza);
                    if (archive_id) {
                        attrs.archive_id = archive_id;
                    }
                    return attrs;
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
                    const { _converse } = this.__super__;
                    _converse.api.disco.supports(Strophe.NS.MAM, _converse.bare_jid).then(
                        (result) => { // Success
                            if (result.supported) {
                                const most_recent_msg = utils.getMostRecentMessage(this.model);
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
                            }
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

                fetchArchivedMessagesIfNecessary () {
                    /* Check if archived messages should be fetched, and if so, do so. */
                    if (this.disable_mam || this.model.get('mam_initialized')) {
                        return;
                    }
                    const { _converse } = this.__super__;
                    _converse.api.disco.supports(Strophe.NS.MAM, _converse.bare_jid).then(
                        (result) => { // Success
                            if (result.supported) {
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
                    /* Fetch archived chat messages from the XMPP server.
                     *
                     * Then, upon receiving them, call onMessage on the chat
                     * box, so that they are displayed inside it.
                     */
                    const { _converse } = this.__super__;
                    if (!_converse.disco_entities.get(_converse.bare_jid)
                            .features.findWhere({'var': Strophe.NS.MAM})) {

                        _converse.log(
                            "Attempted to fetch archived messages but this "+
                            "user's server doesn't support XEP-0313",
                            Strophe.LogLevel.WARN);
                        return;
                    }
                    if (this.disable_mam) {
                        return;
                    }
                    this.addSpinner();
                    _converse.api.archive.query(
                        _.extend({
                            'before': '', // Page backwards from the most recent message
                            'max': _converse.archived_messages_page_size,
                            'with': this.model.get('jid'),
                        }, options),
                        (messages) => { // Success
                            this.clearSpinner();
                            if (messages.length) {
                                _.each(messages, _converse.chatboxes.onMessage.bind(_converse.chatboxes));
                            }
                        },
                        () => { // Error
                            this.clearSpinner();
                            _converse.log(
                                "Error or timeout while trying to fetch "+
                                "archived messages", Strophe.LogLevel.ERROR);
                        }
                    );
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

                onMessage (stanza) {
                    /* MAM (message archive management XEP-0313) messages are
                     * ignored, since they're handled separately.
                     */
                    if (sizzle(`[xmlns="${Strophe.NS.MAM}"]`, stanza).length > 0) {
                        return true;
                    }
                    return this.__super__.onMessage.apply(this, arguments);
                },

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
                },

                fetchArchivedMessages (options) {
                    /* Fetch archived chat messages for this Chat Room
                     *
                     * Then, upon receiving them, call onMessage
                     * so that they are displayed inside it.
                     */
                    const that = this;
                    const { _converse } = this.__super__;
                    this.addSpinner();
                    _converse.api.archive.query(
                        _.extend({
                            'groupchat': true,
                            'before': '', // Page backwards from the most recent message
                            'with': this.model.get('jid'),
                            'max': _converse.archived_messages_page_size
                        }, options),
                        function (messages) {
                            that.clearSpinner();
                            if (messages.length) {
                                _.each(messages, that.model.onMessage.bind(that));
                            }
                        },
                        function () {
                            that.clearSpinner();
                            _converse.log(
                                "Error while trying to fetch archived messages",
                                Strophe.LogLevel.WARN);
                        }
                    );
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

            _converse.onMAMError = function (iq) {
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
                _converse.connection.disco.addFeature(Strophe.NS.MAM);
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
                /* Extend default converse.js API to add methods specific to MAM
                 */
                'archive': {
                    'query': function (options, callback, errback) {
                        /* Do a MAM (XEP-0313) query for archived messages.
                         *
                         * Parameters:
                         *    (Object) options - Query parameters, either
                         *      MAM-specific or also for Result Set Management.
                         *    (Function) callback - A function to call whenever
                         *      we receive query-relevant stanza.
                         *    (Function) errback - A function to call when an
                         *      error stanza is received.
                         *
                         * The options parameter can also be an instance of
                         * Strophe.RSM to enable easy querying between results pages.
                         *
                         * When the the callback is called, a Strophe.RSM object is
                         * returned on which "next" or "previous" can be called
                         * before passing it in again to this method, to
                         * get the next or previous page in the result set.
                         */
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
