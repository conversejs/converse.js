/**
 * @module converse-mam
 * @description XEP-0313 Message Archive Management
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "./converse-disco";
import "./converse-rsm";
import { _converse, api, converse } from "@converse/headless/converse-core";
import log from "./log";
import sizzle from "sizzle";
import st from "./utils/stanza";
import { RSM } from '@converse/headless/converse-rsm';

const { Strophe, $iq, dayjs } = converse.env;
const { NS } = Strophe;
const u = converse.env.utils;

/**
 * The MUC utils object. Contains utility functions related to multi-user chat.
 * @mixin MAMEnabledChat
 */
const MAMEnabledChat = {
    /**
     * Fetches messages that might have been archived *after*
     * the last archived message in our local cache.
     * @private
     */
    fetchNewestMessages () {
        if (this.disable_mam) {
            return;
        }
        const most_recent_msg = this.getMostRecentMessage();
        // if clear_messages_on_reconnection is true, than any recent messages
        // must have been received *after* connection and we instead must query
        // for earlier messages
        if (most_recent_msg && !api.settings.get('clear_messages_on_reconnection')) {
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

    async handleMAMResult (result, query, options, page_direction) {
        await api.emojis.initialize();
        const is_muc = this.get('type') === _converse.CHATROOMS_TYPE;
        result.messages = result.messages.map(
            s => (is_muc ? st.parseMUCMessage(s, this, _converse) : st.parseMessage(s, _converse))
        );

        /**
         * Synchronous event which allows listeners to first do some
         * work based on the MAM result before calling the handlers here.
         * @event _converse#MAMResult
         */
        const data = { query, 'chatbox': this, 'messages': result.messages };
        await api.trigger('MAMResult', data, {'synchronous': true});

        result.messages.forEach(m => this.queueMessage(m));
        if (result.error) {
            const event_id = result.error.retry_event_id = u.getUniqueId();
            api.listen.once(event_id, () => this.fetchArchivedMessages(options, page_direction));
            this.createMessageFromError(result.error);
        }
    },

    /**
     * Fetch XEP-0313 archived messages based on the passed in criteria.
     * @private
     * @param { Object } options
     * @param { integer } [options.max] - The maximum number of items to return.
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
     * @param { boolean } [options.groupchat] - True if archive in groupchat.
     * @param { ('forwards'|'backwards')} [page_direction] - Determines whether this function should
     *  recursively page through the entire result set if a limited number of results were returned.
     */
    async fetchArchivedMessages (options={}, page_direction) {
        if (this.disable_mam) {
            return;
        }
        const is_muc = this.get('type') === _converse.CHATROOMS_TYPE;
        const mam_jid = is_muc ? this.get('jid') : _converse.bare_jid;
        if (!(await api.disco.supports(NS.MAM, mam_jid))) {
            return;
        }
        const max = api.settings.get('archived_messages_page_size')
        const query = Object.assign({
            'groupchat': is_muc,
            'max': max,
            'with': this.get('jid'),
        }, options);

        const result = await api.archive.query(query);
        await this.handleMAMResult(result, query, options, page_direction);

        if (page_direction && result.rsm && !result.complete) {
            if (page_direction === 'forwards') {
                options = result.rsm.next(max, options.before).query;
            } else if (page_direction === 'backwards') {
                options = result.rsm.previous(max, options.after).query;
            }
            return this.fetchArchivedMessages(options, page_direction);
        } else {
            // TODO: Add a special kind of message which will
            // render as a link to fetch further messages, either
            // to fetch older messages or to fill in a gap.
        }
    }
}


converse.plugins.add('converse-mam', {

    dependencies: ['converse-disco', 'converse-muc'],


    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by Converse.js's plugin machinery.
         */
        api.settings.extend({
            archived_messages_page_size: '50',
            message_archiving: undefined, // Supported values are 'always', 'never', 'roster' (https://xmpp.org/extensions/xep-0313.html#prefs)
            message_archiving_timeout: 20000, // Time (in milliseconds) to wait before aborting MAM request
        });

        Object.assign(_converse.ChatBox.prototype, MAMEnabledChat);


        _converse.onMAMError = function (iq) {
            if (iq?.querySelectorAll('feature-not-implemented').length) {
                    log.warn(`Message Archive Management (XEP-0313) not supported by ${iq.getAttribute('from')}`);
            } else {
                log.error(`Error while trying to set archiving preferences for ${iq.getAttribute('from')}.`);
                log.error(iq);
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
            const preference = sizzle(`prefs[xmlns="${NS.MAM}"]`, iq).pop();
            const default_pref = preference.getAttribute('default');
            if (default_pref !== api.settings.get('message_archiving')) {
                const stanza = $iq({'type': 'set'})
                    .c('prefs', {
                        'xmlns':NS.MAM,
                        'default':api.settings.get('message_archiving')
                    });
                Array.from(preference.children).forEach(child => stanza.cnode(child).up());

                // XXX: Strictly speaking, the server should respond with the updated prefs
                // (see example 18: https://xmpp.org/extensions/xep-0313.html#config)
                // but Prosody doesn't do this, so we don't rely on it.
                api.sendIQ(stanza)
                    .then(() => feature.save({'preferences': {'default':api.settings.get('message_archiving')}}))
                    .catch(_converse.onMAMError);
            } else {
                feature.save({'preferences': {'default':api.settings.get('message_archiving')}});
            }
        };

        function getMAMPrefsFromFeature (feature) {
            const prefs = feature.get('preferences') || {};
            if (feature.get('var') !== NS.MAM || api.settings.get('message_archiving') === undefined) {
                return;
            }
            if (prefs['default'] !== api.settings.get('message_archiving')) {
                api.sendIQ($iq({'type': 'get'}).c('prefs', {'xmlns': NS.MAM}))
                    .then(iq => _converse.onMAMPreferences(iq, feature))
                    .catch(_converse.onMAMError);
            }
        }

        function preMUCJoinMAMFetch (room) {
            if (!api.settings.get('muc_show_logs_before_join') ||
                    !room.features.get('mam_enabled') ||
                    room.get('prejoin_mam_fetched')) {
                return;
            }
            room.fetchNewestMessages();
            room.save({'prejoin_mam_fetched': true});
        }

        /************************ BEGIN Event Handlers ************************/
        api.listen.on('addClientFeatures', () => api.disco.own.features.add(NS.MAM));
        api.listen.on('serviceDiscovered', getMAMPrefsFromFeature);
        api.listen.on('chatRoomViewInitialized', view => {
            if (api.settings.get('muc_show_logs_before_join')) {
                preMUCJoinMAMFetch(view.model);
                // If we want to show MAM logs before entering the MUC, we need
                // to be informed once it's clear that this MUC supports MAM.
                view.model.features.on('change:mam_enabled', () => preMUCJoinMAMFetch(view.model));
            }
        });
        api.listen.on('enteredNewRoom', room => room.features.get('mam_enabled') && room.fetchNewestMessages());


        api.listen.on('chatReconnected', chat => {
            // XXX: For MUCs, we listen to enteredNewRoom instead
            if (chat.get('type') === _converse.PRIVATE_CHAT_TYPE) {
                chat.fetchNewestMessages();
            }
        });

        api.listen.on('afterMessagesFetched', chat => {
            // XXX: We don't want to query MAM every time this is triggered
            // since it's not necessary when the chat is restored from cache.
            // (given that BOSH or SMACKS will ensure that you get messages
            // sent during the reload).
            // With MUCs we can listen for `enteredNewRoom`.
            if (chat.get('type') === _converse.PRIVATE_CHAT_TYPE && !_converse.connection.restored) {
                chat.fetchNewestMessages();
            }
        });
        /************************ END Event Handlers **************************/


        /************************ BEGIN API ************************/
        Object.assign(api, {
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
            archive: {
                 /**
                  * @typedef { module:converse-rsm~RSMQueryParameters } MAMFilterParameters
                  * Filter parameters which can be used to filter a MAM XEP-0313 archive
                  * @property { String } [end] - A date string in ISO-8601 format, before which messages should be returned. Implies backward paging.
                  * @property { String } [start] - A date string in ISO-8601 format, after which messages should be returned. Implies forward paging.
                  * @property { String } [with] - A JID against which to match messages, according to either their `to` or `from` attributes.
                  *     An item in a MUC archive matches if the publisher of the item matches the JID.
                  *     If `with` is omitted, all messages that match the rest of the query will be returned, regardless of to/from
                  *     addresses of each message.
                  */

                 /**
                  * The options that can be passed in to the { @link _converse.api.archive.query } method
                  * @typedef { module:converse-mam~MAMFilterParameters } ArchiveQueryOptions
                  * @property { Boolean } [groupchat=false] - Whether the MAM archive is for a groupchat.
                  */

                 /**
                  * Query for archived messages.
                  *
                  * The options parameter can also be an instance of
                  * RSM to enable easy querying between results pages.
                  *
                  * @method _converse.api.archive.query
                  * @param { module:converse-mam~ArchiveQueryOptions } options - An object containing query parameters
                  * @throws {Error} An error is thrown if the XMPP server responds with an error.
                  * @returns { Promise<module:converse-mam~MAMQueryResult> } A promise which resolves
                  *     to a { @link module:converse-mam~MAMQueryResult } object.
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
                  *     result = await api.archive.query();
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
                  *    result = await api.archive.query({'with': 'john@doe.net'});
                  * } catch (e) {
                  *     // The query was not successful
                  * }
                  *
                  * // For a particular room
                  * let result;
                  * try {
                  *    result = await api.archive.query({'with': 'discuss@conference.doglovers.net', 'groupchat': true});
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
                  *    result = await api.archive.query(options);
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
                  *     result = await api.archive.query({'with': 'john@doe.net', 'max':10});
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
                  * // with the returned archived messages, but also a special RSM (*Result Set Management*)
                  * // object which contains the query parameters you passed in, as well
                  * // as two utility methods `next`, and `previous`.
                  * //
                  * // When you call one of these utility methods on the returned RSM object, and then
                  * // pass the result into a new query, you'll receive the next or previous batch of
                  * // archived messages. Please note, when calling these methods, pass in an integer
                  * // to limit your results.
                  *
                  * const options = {'with': 'john@doe.net', 'max':10};
                  * let result;
                  * try {
                  *     result = await api.archive.query(options);
                  * } catch (e) {
                  *     // The query was not successful
                  * }
                  * // Do something with the messages, like showing them in your webpage.
                  * result.messages.forEach(m => this.showMessage(m));
                  *
                  * while (!result.complete) {
                  *     try {
                  *         result = await api.archive.query(Object.assign(options, rsm.next(10).query));
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
                  * const options = {'before': '', 'max':5};
                  * try {
                  *     result = await api.archive.query(options);
                  * } catch (e) {
                  *     // The query was not successful
                  * }
                  * // Do something with the messages, like showing them in your webpage.
                  * result.messages.forEach(m => this.showMessage(m));
                  *
                  * // Now we query again, to get the previous batch.
                  * try {
                  *      result = await api.archive.query(Object.assign(options, rsm.previous(5).query));
                  * } catch (e) {
                  *     // The query was not successful
                  * }
                  * // Do something with the messages, like showing them in your webpage.
                  * result.messages.forEach(m => this.showMessage(m));
                  *
                  */
                async query (options) {
                    if (!api.connection.connected()) {
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
                    const supported = await api.disco.supports(NS.MAM, jid);
                    if (!supported) {
                        log.warn(`Did not fetch MAM archive for ${jid} because it doesn't support ${NS.MAM}`);
                        return {'messages': []};
                    }

                    const queryid = u.getUniqueId();
                    const stanza = $iq(attrs).c('query', {'xmlns':NS.MAM, 'queryid':queryid});
                    if (options) {
                        stanza.c('x', {'xmlns':NS.XFORM, 'type': 'submit'})
                                .c('field', {'var':'FORM_TYPE', 'type': 'hidden'})
                                .c('value').t(NS.MAM).up().up();

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
                        const rsm = new RSM(options);
                        if (Object.keys(rsm.query).length) {
                            stanza.cnode(rsm.toXML());
                        }
                    }

                    const messages = [];
                    const message_handler = _converse.connection.addHandler(stanza => {
                        const result = sizzle(`message > result[xmlns="${NS.MAM}"]`, stanza).pop();
                        if (result === undefined || result.getAttribute('queryid') !== queryid) {
                            return true;
                        }
                        const from = stanza.getAttribute('from') || _converse.bare_jid;
                        if (options.groupchat) {
                            if (from !== options['with']) {
                                log.warn(`Ignoring alleged groupchat MAM message from ${stanza.getAttribute('from')}`);
                                return true;
                            }
                        } else if (from !== _converse.bare_jid) {
                            log.warn(`Ignoring alleged MAM message from ${stanza.getAttribute('from')}`);
                            return true;
                        }
                        messages.push(stanza);
                        return true;
                    }, NS.MAM);

                    let error;
                    const iq_result = await api.sendIQ(stanza, api.settings.get('message_archiving_timeout'), false)
                    if (iq_result === null) {
                        const { __ } = _converse;
                        const err_msg = __("Timeout while trying to fetch archived messages.");
                        log.error(err_msg);
                        error = new _converse.TimeoutError(err_msg);
                        return { messages, error };

                    } else if (u.isErrorStanza(iq_result)) {
                        const { __ } = _converse;
                        const err_msg = __('An error occurred while querying for archived messages.');
                        log.error(err_msg);
                        log.error(iq_result);
                        error = new Error(err_msg);
                        return { messages, error };
                    }
                    _converse.connection.deleteHandler(message_handler);

                    let rsm;
                    const fin = iq_result && sizzle(`fin[xmlns="${NS.MAM}"]`, iq_result).pop();
                    const complete = fin?.getAttribute('complete') === 'true'
                    const set = sizzle(`set[xmlns="${NS.RSM}"]`, fin).pop();
                    if (set) {
                        rsm = new RSM({...options, 'xml': set});
                    }
                    /**
                     * @typedef { Object } MAMQueryResult
                     * @property { Array } messages
                     * @property { RSM } [rsm] - An instance of { @link RSM }.
                     *  You can call `next()` or `previous()` on this instance,
                     *  to get the RSM query parameters for the next or previous
                     *  page in the result set.
                     * @property { Boolean } complete
                     * @property { Error } [error]
                     */
                    return { messages, rsm, complete };
                }
            }
        });
        /************************ END API ************************/
    }
});
