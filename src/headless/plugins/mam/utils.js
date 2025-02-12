/**
 * @typedef {import('../muc/muc.js').default} MUC
 * @typedef {import('../chat/model.js').default} ChatBox
 * @typedef {import('@converse/skeletor/src/types/helpers.js').Model} Model
 */
import sizzle from 'sizzle';
import { Strophe, $iq } from 'strophe.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import log from '../../log.js';
import { parseMUCMessage } from '../../plugins/muc/parsers.js';
import { parseMessage } from '../../plugins/chat/parsers.js';
import { CHATROOMS_TYPE } from '../../shared/constants.js';
import { TimeoutError } from '../../shared/errors.js';
import MAMPlaceholderMessage from './placeholder.js';
import { parseErrorStanza } from '../../shared/parsers.js';

const { NS } = Strophe;
const u = converse.env.utils;

/**
 * @param {Element} iq
 */
export async function onMAMError(iq) {
    const err = await parseErrorStanza(iq);
    if (err?.name === 'feature-not-implemented') {
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
 *
 * @param {Element} iq
 * @param {Model} feature
 */
export function onMAMPreferences(iq, feature) {
    const preference = sizzle(`prefs[xmlns="${NS.MAM}"]`, iq).pop();
    const default_pref = preference.getAttribute('default');
    if (default_pref !== api.settings.get('message_archiving')) {
        const stanza = $iq({ 'type': 'set' }).c('prefs', {
            'xmlns': NS.MAM,
            'default': api.settings.get('message_archiving'),
        });
        Array.from(preference.children).forEach((child) => stanza.cnode(child).up());

        // XXX: Strictly speaking, the server should respond with the updated prefs
        // (see example 18: https://xmpp.org/extensions/xep-0313.html#config)
        // but Prosody doesn't do this, so we don't rely on it.
        api.sendIQ(stanza)
            .then(() => feature.save({ 'preferences': { 'default': api.settings.get('message_archiving') } }))
            .catch(_converse.exports.onMAMError);
    } else {
        feature.save({ 'preferences': { 'default': api.settings.get('message_archiving') } });
    }
}

/**
 * @param {Model} feature
 */
export function getMAMPrefsFromFeature(feature) {
    const prefs = feature.get('preferences') || {};
    if (feature.get('var') !== NS.MAM || api.settings.get('message_archiving') === undefined) {
        return;
    }
    if (prefs['default'] !== api.settings.get('message_archiving')) {
        api.sendIQ($iq({ 'type': 'get' }).c('prefs', { 'xmlns': NS.MAM }))
            .then(/** @param {Element} iq */ (iq) => _converse.exports.onMAMPreferences(iq, feature))
            .catch(_converse.exports.onMAMError);
    }
}

/**
 * @param {MUC} muc
 */
export function preMUCJoinMAMFetch(muc) {
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

async function createMessageFromError (model, error) {
    if (error instanceof TimeoutError) {
        const msg = await model.createMessage({
            'type': 'error',
            'message': error.message,
            'retry_event_id': error.retry_event_id,
            'is_ephemeral': 20000,
        });
        msg.error = error;
    }
}

/**
 * @param {ChatBox|MUC} model
 * @param {Object} result
 * @param {Object} query
 * @param {Object} options
 * @param {('forwards'|'backwards'|null)} [should_page=null]
 */
export async function handleMAMResult(model, result, query, options, should_page) {
    const is_muc = model.get('type') === CHATROOMS_TYPE;
    const doParseMessage = /** @param {Element} s*/ (s) =>
        is_muc ? parseMUCMessage(s, /** @type {MUC} */ (model)) : parseMessage(s);

    const messages = await Promise.all(result.messages.map(doParseMessage));
    result.messages = messages;

    /**
     * Synchronous event which allows listeners to first do some
     * work based on the MAM result before calling the handlers here.
     * @event _converse#MAMResult
     */
    const data = { query, 'chatbox': model, messages };
    await api.trigger('MAMResult', data, { 'synchronous': true });

    messages.forEach((m) => model.queueMessage(m));
    if (result.error) {
        const event_id = (result.error.retry_event_id = u.getUniqueId());
        api.listen.once(event_id, () => fetchArchivedMessages(model, options, should_page));
        createMessageFromError(model, result.error);
    }
}

/**
 * Fetch XEP-0313 archived messages based on the passed in criteria.
 * @param {ChatBox|MUC} model
 * @param {import('./types').MAMOptions} [options]
 * @param {('forwards'|'backwards'|null)} [should_page=null] - Determines whether
 *  this function should recursively page through the entire result set if a limited
 *  number of results were returned.
 */
export async function fetchArchivedMessages(model, options = {}, should_page = null) {
    if (model.disable_mam) {
        return;
    }
    const is_muc = model.get('type') === CHATROOMS_TYPE;
    const bare_jid = _converse.session.get('bare_jid');
    const mam_jid = is_muc ? model.get('jid') : bare_jid;
    if (!(await api.disco.supports(NS.MAM, mam_jid))) {
        return;
    }
    const max = api.settings.get('archived_messages_page_size');

    const query = Object.assign(
        {
            'groupchat': is_muc,
            'max': max,
            'with': model.get('jid'),
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
 * @param {ChatBox|MUC} model
 * @param {import('./types').MAMOptions} options
 * @param {object} result - The RSM result object
 */
async function createPlaceholder(model, options, result) {
    if (options.before == '' && (model.messages.length === 0 || !options.start)) {
        // Fetching the latest MAM messages with an empty local cache
        return;
    }
    if (options.before && !options.start) {
        // Infinite scrolling upward
        return;
    }
    if (options.before == null) {
        // eslint-disable-line no-eq-null
        // Adding placeholders when paging forwards is not supported yet,
        // since currently with standard Converse, we only page forwards
        // when fetching the entire history (i.e. no gaps should arise).
        return;
    }
    const msgs = await Promise.all(result.messages);
    const { rsm } = result;
    const key = `stanza_id ${model.get('jid')}`;
    const adjacent_message = msgs.find((m) => m[key] === rsm.result.first);
    const adjacent_message_date = new Date(adjacent_message['time']);

    const msg_data = {
        'template_hook': 'getMessageTemplate',
        'time': new Date(adjacent_message_date.getTime() - 1).toISOString(),
        'before': rsm.result.first,
        'start': options.start,
    };
    model.messages.add(new MAMPlaceholderMessage(msg_data));
}

/**
 * Fetches messages that might have been archived *after*
 * the last archived message in our local cache.
 * @param {ChatBox|MUC} model
 */
export function fetchNewestMessages(model) {
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
