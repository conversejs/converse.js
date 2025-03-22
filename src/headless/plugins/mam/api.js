import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import dayjs from 'dayjs';
import log from "@converse/log";
import sizzle from "sizzle";
import { RSM } from '../../shared/rsm.js';
import { Strophe, Stanza } from 'strophe.js';
import { TimeoutError } from '../../shared/errors.js';

const { NS } = Strophe;
const { stx, u } = converse.env;


export default {
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
          * Query for archived messages.
          *
          * The options parameter can also be an instance of
          * RSM to enable easy querying between results pages.
          *
          * @method _converse.api.archive.query
          * @param {import('./types').ArchiveQueryOptions} [options={}] - Optional query parameters
          * @throws {Error} An error is thrown if the XMPP server responds with an error.
          * @returns {Promise<import('./types').MAMQueryResult>}
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
          *    result = await api.archive.query({ mam: { with: 'john@doe.net' }});
          * } catch (e) {
          *     // The query was not successful
          * }
          *
          * // For a particular room
          * let result;
          * try {
          *    result = await api.archive.query({ mam: { with: 'discuss@conference.doglovers.net' }}, is_groupchat: true });
          * } catch (e) {
          *     // The query was not successful
          * }
          *
          * @example
          * // Requesting all archived messages before or after a certain date
          * // ===============================================================
          * //
          * // The MAM `start` and `end` parameters are used to query for messages
          * // within a certain timeframe. The passed in date values may either be ISO8601
          * // formatted date strings, or JavaScript Date objects.
          *
          *  const options = {
          *      mam: {
          *          'with': 'john@doe.net',
          *          'start': '2010-06-07T00:00:00Z',
          *          'end': '2010-07-07T13:23:54Z'
          *      },
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
          *     result = await api.archive.query({ mam: { with: 'john@doe.net', max:10 }});
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
          * const options = { mam: { with: 'john@doe.net' }, rsm: { max:10 }};
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
          *         result = await api.archive.query({
          *             mam: { ...options.mam },
          *             rsm: {
          *                 ...options.rsm,
          *                 ...rsm.next(10).query
          *                 }
          *             });
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
          * const options = { rsm: { before: '', max:5 }};
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
          *     try {
          *         result = await api.archive.query({
          *             mam: { ...options.mam },
          *             rsm: {
          *                 ...options.rsm,
          *                 ...rsm.previous(5).query
          *                 }
          *             });
          * } catch (e) {
          *     // The query was not successful
          * }
          * // Do something with the messages, like showing them in your webpage.
          * result.messages.forEach(m => this.showMessage(m));
          *
          */
        async query (options={}) {
            if (!api.connection.connected()) {
                throw new Error('Can\'t call `api.archive.query` before having established an XMPP session');
            }

            let toJID;
            if (options && options.is_groupchat) {
                if (!options.mam?.with) {
                    throw new Error(
                        'You need to specify a "with" value containing '+
                        'the groupchat JID, when querying groupchat messages.');
                }
                toJID = options.mam.with;
            }

            const withJID = !options.is_groupchat && options.mam?.with || null;

            const bare_jid = _converse.session.get('bare_jid');
            const jid = toJID || bare_jid;
            const supported = await api.disco.supports(NS.MAM, jid);
            if (!supported) {
                log.warn(`Did not fetch MAM archive for ${jid} because it doesn't support ${NS.MAM}`);
                return { messages: [] };
            }

            // Validate start and end dates and add them to attrs (in the right format)
            const { start: startDate, end: endDate } = ['start', 'end'].reduce((acc, t) => {
                if (options.mam?.[t]) {
                    const date = dayjs(options.mam[t]);
                    if (date.isValid()) {
                        acc[t] = date.toISOString();
                    } else {
                        throw new TypeError(`archive.query: invalid date provided for: ${t}`);
                    }
                }
                return acc;
            }, { start: null, end: null });

            const connection = api.connection.get();
            const rsm = options.rsm ? new RSM(options.rsm) : {};
            const queryid = u.getUniqueId();

            const stanza = stx`
                <iq id="${u.getUniqueId()}"
                        ${toJID ? Stanza.unsafeXML(`to="${Strophe.xmlescape(toJID)}"`) : ""}
                        type="set"
                        xmlns="jabber:client">
                    <query queryid="${queryid}" xmlns="${NS.MAM}">
                        ${
                            withJID || startDate || endDate
                                ? stx`
                            <x type="submit" xmlns="${NS.XFORM}">
                                <field type="hidden" var="FORM_TYPE"><value>${NS.MAM}</value></field>
                                ${withJID ? stx`<field var="with"><value>${withJID}</value></field>` : ""}
                                ${startDate ? stx`<field var="start"><value>${startDate}</value></field>` : ""}
                                ${endDate ? stx`<field var="end"><value>${endDate}</value></field>` : ""}
                            </x>`
                                : ""
                        }
                        ${Object.keys(rsm.query ?? {}).length ? Stanza.fromString(rsm.toString()) : ""}
                    </query>
                </iq>`;

            const messages = [];
            const message_handler = connection.addHandler(/** @param {Element} stanza */(stanza) => {
                const result = sizzle(`message > result[xmlns="${NS.MAM}"]`, stanza).pop();
                if (result === undefined || result.getAttribute('queryid') !== queryid) {
                    return true;
                }
                const from = stanza.getAttribute('from') || bare_jid;
                if (options.is_groupchat) {
                    if (from !== options.mam?.with) {
                        log.warn(`Ignoring alleged groupchat MAM message from ${stanza.getAttribute('from')}`);
                        return true;
                    }
                } else if (from !== bare_jid) {
                    log.warn(`Ignoring alleged MAM message from ${stanza.getAttribute('from')}`);
                    return true;
                }
                messages.push(stanza);
                return true;
            }, NS.MAM);

            let error;
            const timeout = api.settings.get('message_archiving_timeout');
            const iq_result = await api.sendIQ(stanza, timeout, false);
            if (iq_result === null) {
                const { __ } = _converse;
                const err_msg = __("Timeout while trying to fetch archived messages.");
                log.error(err_msg);
                error = new TimeoutError(err_msg);
                return { messages, error };

            } else if (u.isErrorStanza(iq_result)) {
                const { __ } = _converse;
                const err_msg = __('An error occurred while querying for archived messages.');
                log.error(err_msg);
                log.error(iq_result);
                error = new Error(err_msg);
                return { messages, error };
            }
            connection.deleteHandler(message_handler);

            let rsm_result;
            const fin = iq_result && sizzle(`fin[xmlns="${NS.MAM}"]`, iq_result).pop();
            const complete = fin?.getAttribute('complete') === 'true';
            const set = sizzle(`set[xmlns="${NS.RSM}"]`, fin).pop();
            if (set) {
                rsm_result = new RSM({...options.rsm, xml: set});
            }
            return { messages, rsm: rsm_result, complete };
        }
    }
}
