import MAMPlaceholderMessage from './placeholder.js';
import log from '@converse/headless/log';
import sizzle from 'sizzle';
import { _converse, api, converse } from '@converse/headless/core';
import { parseMUCMessage } from '@converse/headless/plugins/muc/parsers';
import { parseMessage } from '@converse/headless/plugins/chat/parsers';

const { Strophe, $iq } = converse.env;
const { NS } = Strophe;
const u = converse.env.utils;

export function onMAMError (iq) {
    if (iq?.querySelectorAll('feature-not-implemented').length) {
        log.warn(`Message Archive Management (XEP-0313) not supported by ${iq.getAttribute('from')}`);
    } else {
        log.error(`Error while trying to set archiving preferences for ${iq.getAttribute('from')}.`);
        log.error(iq);
    }
}

/**
 * Handle returned IQ stanza containing Message Archive
 * Management (XEP-0313) preferences.
 *
 * XXX: For now we only handle the global default preference.
 * The XEP also provides for per-JID preferences, which is
 * currently not supported in converse.js.
 *
 * Per JID preferences will be set in chat boxes, so it'll
 * probbaly be handled elsewhere in any case.
 */
export function onMAMPreferences (iq, feature) {
    const preference = sizzle(`prefs[xmlns="${NS.MAM}"]`, iq).pop();
    const default_pref = preference.getAttribute('default');
    if (default_pref !== api.settings.get('message_archiving')) {
        const stanza = $iq({ 'type': 'set' }).c('prefs', {
            'xmlns': NS.MAM,
            'default': api.settings.get('message_archiving')
        });
        Array.from(preference.children).forEach(child => stanza.cnode(child).up());

        // XXX: Strictly speaking, the server should respond with the updated prefs
        // (see example 18: https://xmpp.org/extensions/xep-0313.html#config)
        // but Prosody doesn't do this, so we don't rely on it.
        api.sendIQ(stanza)
            .then(() => feature.save({ 'preferences': { 'default': api.settings.get('message_archiving') } }))
            .catch(_converse.onMAMError);
    } else {
        feature.save({ 'preferences': { 'default': api.settings.get('message_archiving') } });
    }
}

export function getMAMPrefsFromFeature (feature) {
    const prefs = feature.get('preferences') || {};
    if (feature.get('var') !== NS.MAM || api.settings.get('message_archiving') === undefined) {
        return;
    }
    if (prefs['default'] !== api.settings.get('message_archiving')) {
        api.sendIQ($iq({ 'type': 'get' }).c('prefs', { 'xmlns': NS.MAM }))
            .then(iq => _converse.onMAMPreferences(iq, feature))
            .catch(_converse.onMAMError);
    }
}

export function preMUCJoinMAMFetch (muc) {
    if (
        !api.settings.get('muc_show_logs_before_join') ||
        !muc.features.get('mam_enabled') ||
        muc.get('prejoin_mam_fetched')
    ) {
        return;
    }
    fetchNewestMessages(muc);
    muc.save({ 'prejoin_mam_fetched': true });
}

export async function handleMAMResult (model, result, query, options, should_page) {
    await api.emojis.initialize();
    const is_muc = model.get('type') === _converse.CHATROOMS_TYPE;
    const doParseMessage = s => is_muc ? parseMUCMessage(s, model) : parseMessage(s);
    const messages = await Promise.all(result.messages.map(doParseMessage));
    result.messages = messages;

    /**
     * Synchronous event which allows listeners to first do some
     * work based on the MAM result before calling the handlers here.
     * @event _converse#MAMResult
     */
    const data = { query, 'chatbox': model, messages };
    await api.trigger('MAMResult', data, { 'synchronous': true });

    messages.forEach(m => model.queueMessage(m));
    if (result.error) {
        const event_id = (result.error.retry_event_id = u.getUniqueId());
        api.listen.once(event_id, () => fetchArchivedMessages(model, options, should_page));
        model.createMessageFromError(result.error);
    }
}

/**
 * @typedef { Object } MAMOptions
 * A map of MAM related options that may be passed to fetchArchivedMessages
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
 */

/**
 * Fetch XEP-0313 archived messages based on the passed in criteria.
 * @param { _converse.ChatBox | _converse.ChatRoom } model
 * @param { MAMOptions } [options]
 * @param { ('forwards'|'backwards'|null)} [should_page=null] - Determines whether
 *  this function should recursively page through the entire result set if a limited
 *  number of results were returned.
 */
export async function fetchArchivedMessages (model, options = {}, should_page = null) {
    if (model.disable_mam) {
        return;
    }
    const is_muc = model.get('type') === _converse.CHATROOMS_TYPE;
    const mam_jid = is_muc ? model.get('jid') : _converse.bare_jid;
    if (!(await api.disco.supports(NS.MAM, mam_jid))) {
        return;
    }
    const max = api.settings.get('archived_messages_page_size');
    const query = Object.assign(
        {
            'groupchat': is_muc,
            'max': max,
            'with': model.get('jid')
        },
        options
    );

    const result = await api.archive.query(query);
    await handleMAMResult(model, result, query, options, should_page);

    if (result.rsm && !result.complete) {
        if (should_page) {
            if (should_page === 'forwards') {
                options = result.rsm.next(max, options.before).query;
            } else if (should_page === 'backwards') {
                options = result.rsm.previous(max, options.after).query;
            }
            return fetchArchivedMessages(model, options, should_page);
        } else {
            createPlaceholder(model, options, result);
        }
    }
}

/**
 * Create a placeholder message which is used to indicate gaps in the history.
 * @param { _converse.ChatBox | _converse.ChatRoom } model
 * @param { MAMOptions } options
 * @param { object } result - The RSM result object
 */
async function createPlaceholder (model, options, result) {
    if (options.before == '' && (model.messages.length === 0 || !options.start)) {
        // Fetching the latest MAM messages with an empty local cache
        return;
    }
    if (options.before && !options.start) {
        // Infinite scrolling upward
        return;
    }
    if (options.before == null) { // eslint-disable-line no-eq-null
        // Adding placeholders when paging forwards is not supported yet,
        // since currently with standard Converse, we only page forwards
        // when fetching the entire history (i.e. no gaps should arise).
        return;
    }
    const msgs = await Promise.all(result.messages);
    const { rsm } = result;
    const key = `stanza_id ${model.get('jid')}`;
    const adjacent_message = msgs.find(m => m[key] === rsm.result.first);
    const msg_data = {
        'template_hook': 'getMessageTemplate',
        'time': new Date(new Date(adjacent_message['time']) - 1).toISOString(),
        'before': rsm.result.first,
        'start': options.start
    }
    model.messages.add(new MAMPlaceholderMessage(msg_data));
}

/**
 * Fetches messages that might have been archived *after*
 * the last archived message in our local cache.
 * @param { _converse.ChatBox | _converse.ChatRoom }
 */
export function fetchNewestMessages (model) {
    if (model.disable_mam) {
        return;
    }
    const most_recent_msg = model.getMostRecentMessage();

    // if clear_messages_on_reconnection is true, than any recent messages
    // must have been received *after* connection and we instead must query
    // for earlier messages
    if (most_recent_msg && !api.settings.get('clear_messages_on_reconnection')) {
        const should_page = api.settings.get('mam_request_all_pages');
        if (should_page) {
            const stanza_id = most_recent_msg.get(`stanza_id ${model.get('jid')}`);
            if (stanza_id) {
                fetchArchivedMessages(model, { 'after': stanza_id }, 'forwards');
            } else {
                fetchArchivedMessages(model, { 'start': most_recent_msg.get('time') }, 'forwards');
            }
        } else {
            fetchArchivedMessages(model, { 'before': '', 'start': most_recent_msg.get('time') });
        }
    } else {
        fetchArchivedMessages(model, { 'before': '' });
    }
}
