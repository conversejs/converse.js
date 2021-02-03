import log from '@converse/headless/log';
import sizzle from 'sizzle';
import { parseMUCMessage } from '@converse/headless/plugins/muc/parsers';
import { parseMessage } from '@converse/headless/plugins/chat/parsers';
import { _converse, api, converse } from '@converse/headless/core';

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
    result.messages = result.messages.map(s =>
        is_muc ? parseMUCMessage(s, model, _converse) : parseMessage(s, _converse)
    );

    /**
     * Synchronous event which allows listeners to first do some
     * work based on the MAM result before calling the handlers here.
     * @event _converse#MAMResult
     */
    const data = { query, 'chatbox': model, 'messages': result.messages };
    await api.trigger('MAMResult', data, { 'synchronous': true });

    result.messages.forEach(m => model.queueMessage(m));
    if (result.error) {
        const event_id = (result.error.retry_event_id = u.getUniqueId());
        api.listen.once(event_id, () => fetchArchivedMessages(model, options, should_page));
        model.createMessageFromError(result.error);
    }
}

/**
 * Fetch XEP-0313 archived messages based on the passed in criteria.
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
 * @param { ('forwards'|'backwards'|null)} [should_page=null] - Determines whether this function should
 *  recursively page through the entire result set if a limited number of results were returned.
 */
export async function fetchArchivedMessages (model, options = {}, should_page=null) {
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
            // TODO: Add a special kind of message which will
            // render as a link to fetch further messages, either
            // to fetch older messages or to fill in a gap.
        }
    }
}

/**
 * Fetches messages that might have been archived *after*
 * the last archived message in our local cache.
 */
export function fetchNewestMessages (model) {
    if (model.disable_mam) {
        return;
    }
    const most_recent_msg = model.most_recent_cached_message;

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
