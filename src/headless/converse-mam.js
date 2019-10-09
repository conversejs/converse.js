// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// Copyright (c) Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/**
 * @module converse-mam
 * @description
 * XEP-0313 Message Archive Management
 */
import "./converse-disco";
import "./converse-rsm";
import { intersection, pick } from 'lodash'
import converse from "./converse-core";
import sizzle from "sizzle";

const { Strophe, $iq, dayjs } = converse.env;
const u = converse.env.utils;

// XEP-0313 Message Archive Management
const MAM_ATTRIBUTES = ['with', 'start', 'end'];


converse.plugins.add('converse-mam', {

    dependencies: ['converse-rsm', 'converse-disco', 'converse-muc'],

    overrides: {
        // Overrides mentioned here will be picked up by converse.js's
        // plugin architecture they will replace existing methods on the
        // relevant objects or classes.
        ChatBox: {
            async getDuplicateMessage (stanza) {
                const message = await this.__super__.getDuplicateMessage.apply(this, arguments);
                if (!message) {
                    return this.findDuplicateFromArchiveID(stanza);
                }
                return message;
            },

            getUpdatedMessageAttributes (message, stanza) {
                const attrs = this.__super__.getUpdatedMessageAttributes.apply(this, arguments);
                if (message && !message.get('is_archived')) {
                    return Object.assign(attrs, {
                        'is_archived': this.isArchived(stanza)
                    }, this.getStanzaIDs(stanza))
                }
                return attrs;
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
            message_archiving_timeout: 20000, // Time (in milliseconds) to wait before aborting MAM request
        });

        const MAMEnabledChat = {

            /**
             * Fetches messages that might have been archived *after*
             * the last archived message in our local cache.
             */
            fetchNewestMessages () {
                if (this.disable_mam) {
                    return;
                }
                const most_recent_msg = this.getMostRecentMessage();
                if (most_recent_msg) {
                    const stanza_id = most_recent_msg.get(`stanza_id ${this.get('jid')}`);
                    if (stanza_id) {
                        this.fetchArchivedMessages({'after': stanza_id}, 'forwards');
                    } else {
                        this.fetchArchivedMessages({'start': most_recent_msg.get('time')}, 'forwards');
                    }
                } else {
                    this.fetchArchivedMessages({'before': ''});
                }
            },

            /**
             * Fetch XEP-0313 archived messages based on the passed in criteria.
             * @private
             * @param { Object } options
             * @param { integer } [options.max] - The maxinum number of items to return.
             *  Defaults to "archived_messages_page_size"
             * @param { string } [options.after] - The XEP-0359 stanza ID of a message
             *  after which messages should be returned. Implies forward paging.
             * @param { string } [options.before] - The XEP-0359 stanza ID of a message
             *  before which messages should be returned. Implies backward paging.
             * @param { string } [options.end] - A date string in ISO-8601 format,
             *  before which messages should be returned. Implies backward paging.
             * @param { string } [options.start] - A date string in ISO-8601 format,
             *  after which messages should be returned. Implies forward paging.
             * @param { string } [options.with] - The JID of the entity with
             *  which messages were exchanged.
             * @param { boolean } [page] - Whether this function should recursively
             *  page through the entire result set if a limited number of results
             *  were returned.
             */
            async fetchArchivedMessages (options={}, page) {
                if (this.disable_mam) {
                    return;
                }
                const is_groupchat = this.get('type') === _converse.CHATROOMS_TYPE;
                const mam_jid = is_groupchat ? this.get('jid') : _converse.bare_jid;
                if (!(await _converse.api.disco.supports(Strophe.NS.MAM, mam_jid))) {
                    return;
                }
                const message_handler = is_groupchat ?
                    this.onMessage.bind(this) :
                    _converse.chatboxes.onMessage.bind(_converse.chatboxes);

                const query = Object.assign({
                        'groupchat': is_groupchat,
                        'max': _converse.archived_messages_page_size,
                        'with': this.get('jid'),
                    }, options);

                const result = await _converse.api.archive.query(query);
                /* eslint-disable no-await-in-loop */
                for (const message of result.messages) {
                    try {
                        await message_handler(message);
                    } catch (e) {
                        _converse.log(e, Strophe.LogLevel.ERROR);
                    }
                }

                if (result.error) {
                    result.error.retry = () => this.fetchArchivedMessages(options, page);
                    this.createMessageFromError(result.error);
                }

                if (page && result.rsm) {
                    if (page === 'forwards') {
                        options = result.rsm.next(_converse.archived_messages_page_size, options.before);
                    } else if (page === 'backwards') {
                        options = result.rsm.previous(_converse.archived_messages_page_size, options.after);
                    }
                    return this.fetchArchivedMessages(options, page);
                } else {
                    // TODO: Add a special kind of message which will
                    // render as a link to fetch further messages, either
                    // to fetch older messages or to fill in a gap.
                }
            },

            async findDuplicateFromArchiveID (stanza) {
                const result = sizzle(`result[xmlns="${Strophe.NS.MAM}"]`, stanza).pop();
                if (!result) {
                    return null;
                }
                const by_jid = stanza.getAttribute('from') || this.get('jid');
                const supported = await _converse.api.disco.supports(Strophe.NS.MAM, by_jid);
                if (!supported) {
                    return null;
                }
                const query = {};
                query[`stanza_id ${by_jid}`] = result.getAttribute('id');
                return this.messages.findWhere(query);
            },

        }
        Object.assign(_converse.ChatBox.prototype, MAMEnabledChat);


        Object.assign(_converse.ChatRoom.prototype, {
            fetchArchivedMessagesIfNecessary () {
                if (this.get('connection_status') !== converse.ROOMSTATUS.ENTERED ||
                        !this.get('mam_enabled') ||
                        this.get('mam_initialized')) {
                    return;
                }
                this.fetchNewestMessages();
                this.save({'mam_initialized': true});
            }
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

        _converse.onMAMPreferences = function (iq, feature) {
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
                Array.from(preference.children).forEach(child => stanza.cnode(child).up());

                // XXX: Strictly speaking, the server should respond with the updated prefs
                // (see example 18: https://xmpp.org/extensions/xep-0313.html#config)
                // but Prosody doesn't do this, so we don't rely on it.
                _converse.api.sendIQ(stanza)
                    .then(() => feature.save({'preferences': {'default':_converse.message_archiving}}))
                    .catch(_converse.onMAMError);
            } else {
                feature.save({'preferences': {'default':_converse.message_archiving}});
            }
        };

        /************************ BEGIN Event Handlers ************************/
        function getMAMPrefsFromFeature (feature) {
            const prefs = feature.get('preferences') || {};
            if (feature.get('var') !== Strophe.NS.MAM || _converse.message_archiving === undefined) {
                return;
            }
            if (prefs['default'] !== _converse.message_archiving) {
                _converse.api.sendIQ($iq({'type': 'get'}).c('prefs', {'xmlns': Strophe.NS.MAM}))
                    .then(iq => _converse.onMAMPreferences(iq, feature))
                    .catch(_converse.onMAMError);
            }
        }

        _converse.api.listen.on('addClientFeatures', () => _converse.api.disco.own.features.add(Strophe.NS.MAM));
        _converse.api.listen.on('serviceDiscovered', getMAMPrefsFromFeature);
        _converse.api.listen.on('enteredNewRoom', chat => chat.fetchNewestMessages());
        _converse.api.listen.on('chatReconnected', chat => {
            // XXX: For MUCs, we listen to enteredNewRoom instead
            if (chat.get('type') === _converse.PRIVATE_CHAT_TYPE) {
                chat.fetchNewestMessages();
            }
        });
        _converse.api.listen.on('afterMessagesFetched', chat => {
            // XXX: We don't want to query MAM every time this is triggered
            // since it's not necessary when the chat is restored from cache.
            // (given that BOSH or SMACKS will ensure that you get messages
            // sent during the reload).
            //
            // With MUCs we can listen for `enteredNewRoom` but for
            // one-on-one we have to use this hacky solutoin for now.
            // `chat_state` is `undefined` only for newly created chats.
            if (chat.get('type') === _converse.PRIVATE_CHAT_TYPE && chat.get('chat_state') === undefined) {
                chat.fetchNewestMessages();
            }
        });

        _converse.api.listen.on('chatRoomOpened', (room) => {
            room.on('change:mam_enabled', room.fetchArchivedMessagesIfNecessary, room);
            room.on('change:connection_status', room.fetchArchivedMessagesIfNecessary, room);
        });
        /************************ END Event Handlers **************************/


        /************************ BEGIN API ************************/
        Object.assign(_converse.api, {
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
                  * _converse.RSM to enable easy querying between results pages.
                  *
                  * @method _converse.api.archive.query
                  * @param {(Object|_converse.RSM)} options Query parameters, either
                  *      MAM-specific or also for Result Set Management.
                  *      Can be either an object or an instance of _converse.RSM.
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
                  * @throws {Error} An error is thrown if the XMPP server responds with an error.
                  * @returns { (Promise<Object> | _converse.TimeoutError) } A promise which resolves
                  * to an object which will have keys `messages` and `rsm` which contains a _converse.RSM
                  * object on which "next" or "previous" can be called before passing it in again
                  * to this method, to get the next or previous page in the result set.
                  *
                  * @example
                  * // Requesting all archived messages
                  * // ================================
                  * //
                  * // The simplest query that can be made is to simply not pass in any parameters.
                  * // Such a query will return all archived messages for the current user.
                  *
                  * let result;
                  * try {
                  *     result = await _converse.api.archive.query();
                  * } catch (e) {
                  *     // The query was not successful, perhaps inform the user?
                  *     // The IQ stanza returned by the XMPP server is passed in, so that you
                  *     // may inspect it and determine what the problem was.
                  * }
                  * // Do something with the messages, like showing them in your webpage.
                  * result.messages.forEach(m => this.showMessage(m));
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
                  * let result;
                  * try {
                  *    result = await _converse.api.archive.query({'with': 'john@doe.net'});
                  * } catch (e) {
                  *     // The query was not successful
                  * }
                  *
                  * // For a particular room
                  * let result;
                  * try {
                  *    result = await _converse.api.archive.query({'with': 'discuss@conference.doglovers.net'});
                  * } catch (e) {
                  *     // The query was not successful
                  * }
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
                  * let result;
                  * try {
                  *    result = await _converse.api.archive.query(options);
                  * } catch (e) {
                  *     // The query was not successful
                  * }
                  *
                  * @example
                  * // Limiting the amount of messages returned
                  * // ========================================
                  * //
                  * // The amount of returned messages may be limited with the `max` parameter.
                  * // By default, the messages are returned from oldest to newest.
                  *
                  * // Return maximum 10 archived messages
                  * let result;
                  * try {
                  *     result = await _converse.api.archive.query({'with': 'john@doe.net', 'max':10});
                  * } catch (e) {
                  *     // The query was not successful
                  * }
                  *
                  * @example
                  * // Paging forwards through a set of archived messages
                  * // ==================================================
                  * //
                  * // When limiting the amount of messages returned per query, you might want to
                  * // repeatedly make a further query to fetch the next batch of messages.
                  * //
                  * // To simplify this usecase for you, the callback method receives not only an array
                  * // with the returned archived messages, but also a special _converse.RSM (*Result Set Management*)
                  * // object which contains the query parameters you passed in, as well
                  * // as two utility methods `next`, and `previous`.
                  * //
                  * // When you call one of these utility methods on the returned RSM object, and then
                  * // pass the result into a new query, you'll receive the next or previous batch of
                  * // archived messages. Please note, when calling these methods, pass in an integer
                  * // to limit your results.
                  *
                  * let result;
                  * try {
                  *     result = await _converse.api.archive.query({'with': 'john@doe.net', 'max':10});
                  * } catch (e) {
                  *     // The query was not successful
                  * }
                  * // Do something with the messages, like showing them in your webpage.
                  * result.messages.forEach(m => this.showMessage(m));
                  *
                  * while (result.rsm) {
                  *     try {
                  *         result = await _converse.api.archive.query(rsm.next(10));
                  *     } catch (e) {
                  *         // The query was not successful
                  *     }
                  *     // Do something with the messages, like showing them in your webpage.
                  *     result.messages.forEach(m => this.showMessage(m));
                  * }
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
                  * let result;
                  * try {
                  *     result = await _converse.api.archive.query({'before': '', 'max':5});
                  * } catch (e) {
                  *     // The query was not successful
                  * }
                  * // Do something with the messages, like showing them in your webpage.
                  * result.messages.forEach(m => this.showMessage(m));
                  *
                  * // Now we query again, to get the previous batch.
                  * try {
                  *      result = await _converse.api.archive.query(rsm.previous(5););
                  * } catch (e) {
                  *     // The query was not successful
                  * }
                  * // Do something with the messages, like showing them in your webpage.
                  * result.messages.forEach(m => this.showMessage(m));
                  *
                  */
                async query (options) {
                    if (!_converse.api.connection.connected()) {
                        throw new Error('Can\'t call `api.archive.query` before having established an XMPP session');
                    }
                    const attrs = {'type':'set'};
                    if (options && options.groupchat) {
                        if (!options['with']) {
                            throw new Error(
                                'You need to specify a "with" value containing '+
                                'the chat room JID, when querying groupchat messages.');
                        }
                        attrs.to = options['with'];
                    }

                    const jid = attrs.to || _converse.bare_jid;
                    const supported = await _converse.api.disco.supports(Strophe.NS.MAM, jid);
                    if (!supported) {
                        _converse.log(`Did not fetch MAM archive for ${jid} because it doesn't support ${Strophe.NS.MAM}`);
                        return {'messages': []};
                    }

                    const queryid = _converse.connection.getUniqueId();
                    const stanza = $iq(attrs).c('query', {'xmlns':Strophe.NS.MAM, 'queryid':queryid});
                    if (options) {
                        stanza.c('x', {'xmlns':Strophe.NS.XFORM, 'type': 'submit'})
                                .c('field', {'var':'FORM_TYPE', 'type': 'hidden'})
                                .c('value').t(Strophe.NS.MAM).up().up();

                        if (options['with'] && !options.groupchat) {
                            stanza.c('field', {'var':'with'}).c('value')
                                .t(options['with']).up().up();
                        }
                        ['start', 'end'].forEach(t => {
                            if (options[t]) {
                                const date = dayjs(options[t]);
                                if (date.isValid()) {
                                    stanza.c('field', {'var':t}).c('value').t(date.toISOString()).up().up();
                                } else {
                                    throw new TypeError(`archive.query: invalid date provided for: ${t}`);
                                }
                            }
                        });
                        stanza.up();
                        if (options instanceof _converse.RSM) {
                            stanza.cnode(options.toXML());
                        } else if (intersection(_converse.RSM_ATTRIBUTES, Object.keys(options)).length) {
                            stanza.cnode(new _converse.RSM(options).toXML());
                        }
                    }

                    const messages = [];
                    const message_handler = _converse.connection.addHandler(stanza => {
                        const result = sizzle(`message > result[xmlns="${Strophe.NS.MAM}"]`, stanza).pop();
                        if (result === undefined || result.getAttribute('queryid') !== queryid) {
                            return true;
                        }
                        const from = stanza.getAttribute('from') || _converse.bare_jid;
                        if (options.groupchat) {
                            if (from !== options['with']) {
                                _converse.log(`Ignoring alleged groupchat MAM message from ${stanza.getAttribute('from')}`, Strophe.LogLevel.WARN);
                                return true;
                            }
                        } else if (from !== _converse.bare_jid) {
                            _converse.log(`Ignoring alleged MAM message from ${stanza.getAttribute('from')}`, Strophe.LogLevel.WARN);
                            return true;
                        }
                        messages.push(stanza);
                        return true;
                    }, Strophe.NS.MAM);

                    let error;
                    const iq_result = await _converse.api.sendIQ(stanza, _converse.message_archiving_timeout, false)
                    if (iq_result === null) {
                        const err_msg = "Timeout while trying to fetch archived messages.";
                        _converse.log(err_msg, Strophe.LogLevel.ERROR);
                        error = new _converse.TimeoutError(err_msg);
                        return { messages, error };

                    } else if (u.isErrorStanza(iq_result)) {
                        _converse.log("Error stanza received while trying to fetch archived messages", Strophe.LogLevel.ERROR);
                        _converse.log(iq_result, Strophe.LogLevel.ERROR);
                        return { messages };
                    }
                    _converse.connection.deleteHandler(message_handler);

                    let rsm;
                    const fin = iq_result && sizzle(`fin[xmlns="${Strophe.NS.MAM}"]`, iq_result).pop();
                    if (fin && [null, 'false'].includes(fin.getAttribute('complete'))) {
                        const set = sizzle(`set[xmlns="${Strophe.NS.RSM}"]`, fin).pop();
                        if (set) {
                            rsm = new _converse.RSM({'xml': set});
                            Object.assign(rsm, Object.assign(pick(options, [...MAM_ATTRIBUTES, ..._converse.RSM_ATTRIBUTES]), rsm));
                        }
                    }
                    return { messages, rsm, error };
                }
            }
        });
        /************************ END API ************************/
    }
});
