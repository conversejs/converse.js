/**
 * @typedef {import('../muc/muc').default} MUC
 * @typedef {import('../chat/model').default} ChatBox
 * @typedef {import('@converse/skeletor').Model} Model
 */
import sizzle from '#sizzle';
import { Strophe, $iq } from 'strophe.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import log from '@converse/log';
import { parseMUCMessage } from '../../plugins/muc/parsers.js';
import { parseMessage } from '../../plugins/chat/parsers.js';
import { CHATROOMS_TYPE } from '../../shared/constants.js';
import { TimeoutError } from '../../shared/errors.js';
import MAMPlaceholderMessage from './placeholder.js';
import { parseErrorStanza } from '../../shared/parsers.js';

const { NS } = Strophe;
const u = converse.env.utils;
const { stx } = converse.env;

/**
 * @param {Element|Error} e
 * @param {Element} iq
 */
export async function onMAMError(e, iq) {
    if (u.isElement(e)) {
        const err = await parseErrorStanza(e);
        if (err?.name === 'feature-not-implemented') {
            log.warn(`Message Archive Management (XEP-0313) not supported by ${iq.getAttribute('to')}`);
            return;
        }
    }
    log.error(`Error while trying to set archiving preferences for ${iq.getAttribute('to')}.`);
    log.error(iq);
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
 * probably be handled elsewhere in any case.
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
            .catch(/** @param {Error|Element} e */ (e) => _converse.exports.onMAMError(e, stanza.tree()));
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
        const stanza = stx`
            <iq type="get" xmlns="jabber:client">
                <prefs xmlns="${NS.MAM}"></prefs>
            </iq>`;
        api.sendIQ(stanza)
            .then(/** @param {Element} iq */ (iq) => _converse.exports.onMAMPreferences(iq, feature))
            .catch(/** @param {Error|Element} e */ (e) => _converse.exports.onMAMError(e, stanza.tree()));
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
    muc.save({ prejoin_mam_fetched: true });
}

/**
 * @param {ChatBox|MUC} model
 * @param {Error|string} error
 */
async function createMessageFromError(model, error) {
    if (error instanceof TimeoutError) {
        const msg = await model.createMessage({
            type: 'error',
            message: error.message,
            retry_event_id: error.retry_event_id,
            is_ephemeral: 20000,
        });
        msg.error = error;
    }
}

/**
 * @param {ChatBox|MUC} model
 * @param {Object} result
 * @param {Object} query
 * @param {Object} options
 * @param {('forwards'|'backwards'|false)} [should_page=false]
 */
export async function handleMAMResult(model, result, query, options, should_page = false) {
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
 * @param {import('./types').FetchArchivedMessagesOptions} [options]
 * @param {('forwards'|'backwards'|false)} [should_page=false] - Determines whether
 *  this function should recursively page through the entire result set if a limited
 *  number of results were returned.
 * @returns {Promise<import('./types').MAMQueryResult|undefined>} The archive's
 *  answer, which has an `error` if the query failed. Undefined if no query was made.
 */
export async function fetchArchivedMessages(model, options = {}, should_page = false) {
    if (model.disable_mam) return;

    const is_muc = model.get('type') === CHATROOMS_TYPE;
    const bare_jid = _converse.session.get('bare_jid');
    const mam_jid = is_muc ? model.get('jid') : bare_jid;

    const supported = await api.disco.supports(NS.MAM, mam_jid);
    if (!supported) return;

    // The session may have been torn down while we were awaiting above. If so,
    // there's no point querying the archive (and `api.archive.query` would throw).
    if (!api.connection.connected()) return;

    const max = api.settings.get('archived_messages_page_size');
    const query = /** @type {import('./types').ArchiveQueryOptions} */ {
        is_groupchat: is_muc,
        rsm: {
            max,
            ...options.rsm,
        },
        mam: {
            with: model.get('jid'),
            ...options.mam,
        },
    };

    const result = await api.archive.query(query);
    await handleMAMResult(model, result, query, options, should_page);

    if (result.rsm && !result.complete) {
        if (should_page) {
            if (should_page === 'forwards') {
                options = result.rsm.next(max, options.rsm.before).query;
            } else if (should_page === 'backwards') {
                options = result.rsm.previous(max, options.rsm.after).query;
            }
            return fetchArchivedMessages(model, options, should_page);
        } else {
            createGapPlaceholder(model, options, result);
        }
    }
    return result;
}

/**
 * @param {ChatBox|MUC} model
 * @returns {string} The JID of the archive that holds the conversation's history
 */
function getArchiveJID(model) {
    return model.get('type') === CHATROOMS_TYPE ? model.get('jid') : _converse.session.get('bare_jid');
}

/**
 * Finds the message which the archive gave `archive_id`, either for its
 * original version or for one of its XEP-0308 corrections.
 * @param {ChatBox|MUC} model
 * @param {string} archive_id
 * @param {string} [by_jid] - The JID of the archive
 */
function findByArchiveID(model, archive_id, by_jid = getArchiveJID(model)) {
    return model.messages.find((m) => model.isChatMessage(m) && m.getStanzaIDs(by_jid).includes(archive_id));
}

/**
 * Creates a placeholder to fill gaps in the history.
 * @param {ChatBox|MUC} model
 * @param {import('./types').ArchiveQueryOptions} [options]
 * @param {import('./types').MAMQueryResult} [result]
 */
async function createGapPlaceholder(model, options, result) {
    const { rsm } = result;
    // Taken before waiting, since the session can end in the meantime.
    const archive_jid = getArchiveJID(model);
    // The page's messages are queued, and the gap goes on the oldest of them once it's held.
    await model.msg_chain;
    const message = findByArchiveID(model, rsm.result.first, archive_jid);
    if (message) {
        // Paged from the page's first archive id, which is a correction's if the message was corrected.
        recordGap(model, message, { before: rsm.result.first, start: options.mam?.start });
    } else {
        const msgs = await Promise.all(result.messages);
        const key = `stanza_id ${archive_jid}`;
        const adjacent_message = msgs.find((m) => m[key] === rsm.result.first);
        addPlaceholder(model, adjacent_message['time'], { before: rsm.result.first, start: options.mam?.start });
    }
}

/**
 * Adds a placeholder just before `time`, for the history that the archive
 * query in `query` would fetch, unless there's one already.
 * @param {ChatBox|MUC} model
 * @param {Date|string} time - The time of the message that the history precedes
 * @param {{ before?: string, start?: string, end?: string }} query
 * @returns {MAMPlaceholderMessage}
 */
function addPlaceholder(model, time, query) {
    const msg_data = {
        ...Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined)),
        template_hook: 'getMessageTemplate',
        time: new Date(new Date(time).getTime() - 1).toISOString(),
    };
    const existing = model.messages.findWhere(msg_data);
    if (existing) {
        log.debug('Gap placeholder already exists, not recreating.');
        return /** @type {MAMPlaceholderMessage} */ (existing);
    }
    return /** @type {MAMPlaceholderMessage} */ (model.messages.add(new MAMPlaceholderMessage(msg_data)));
}

/**
 * Records on `message` that the history right before it, back to `start`
 * (or without limit), hasn't been fetched, so that the gap is still known
 * after a reload, and adds the placeholder for it.
 * @param {ChatBox|MUC} model
 * @param {import('../../shared/message.js').default} message
 * @param {{ before?: string, start?: string }} gap - `before` is the archive id
 *  to page back from, by default the message's own
 */
function recordGap(model, message, gap) {
    message.save({ mam_gap: gap });
    addGapPlaceholder(model, message);
}

/**
 * Adds the placeholder for the gap recorded on `message`, in place of the one it had.
 * @param {ChatBox|MUC} model
 * @param {import('../../shared/message.js').default} message
 */
export function addGapPlaceholder(model, message) {
    model.messages
        .filter((m) => m instanceof MAMPlaceholderMessage && m.gap_message === message)
        .forEach((p) => p.destroy());

    const { start, before = message.get(`stanza_id ${getArchiveJID(model)}`) } = message.get('mam_gap');
    const time = message.get('time');
    const placeholder = addPlaceholder(model, time, before ? { before, start } : { start, end: time });
    placeholder.gap_message = message;
}

/**
 * Records the gaps in the history on either side of messages that were added
 * out of sequence, such as search matches, up to the nearest message held on
 * each side, since nothing says what's between them. A gap that such a
 * message falls in is split in two.
 * @param {ChatBox|MUC} model
 * @param {import('../../shared/message.js').default[]} added
 */
function addPlaceholdersAround(model, added) {
    const isGap = (m) => m instanceof MAMPlaceholderMessage;
    let unbounded = false;
    for (const message of added) {
        const models = model.messages.models;
        const i = models.indexOf(message);
        const time = message.get('time');
        let start = models
            .slice(0, i)
            .reverse()
            .find((m) => model.isChatMessage(m))
            ?.get('time');

        const newer = models.slice(i + 1).find((m) => isGap(m) || model.isChatMessage(m));
        if (isGap(newer)) {
            const gap = /** @type {MAMPlaceholderMessage} */ (newer);
            const gap_start = gap.get('start');
            if (gap_start === undefined || Date.parse(gap_start) < Date.parse(time)) {
                const gap_message =
                    gap.gap_message ?? models.slice(models.indexOf(gap) + 1).find((m) => model.isChatMessage(m));
                gap.destroy();
                if (gap_message) recordGap(model, gap_message, { before: gap.get('before'), start: time });

                if (gap_start === undefined) {
                    unbounded ||= start === undefined;
                } else if (start === undefined || Date.parse(gap_start) > Date.parse(start)) {
                    start = gap_start;
                }
            }
        } else if (newer && !added.includes(newer)) {
            recordGap(model, newer, { start: time });
        }
        // A message that was added too is the newer side of its own gap.
        if (start !== undefined) recordGap(model, message, { start });
    }
    // What's left of a gap without an older limit goes on from before the oldest message.
    if (unbounded) createScrollupPlaceholder(model);
}

/**
 * Creates a placeholder to fetch messages at the top of the chat history.
 * @param {ChatBox|MUC} model
 */
export function createScrollupPlaceholder(model) {
    const oldest_message = model.getOldestMessage();
    if (!oldest_message) return;

    const key = `stanza_id ${getArchiveJID(model)}`;
    addPlaceholder(model, oldest_message.get('time'), { before: oldest_message.get(key) });
}

/**
 * Fetches messages that might have been archived *after*
 * the last archived message in our local cache.
 * @param {ChatBox|MUC} model
 */
export function fetchNewestMessages(model) {
    if (model.disable_mam) return;

    // XXX: It's important to first get the most recent message, before making any
    // async calls, like `api.disco.supports`, so that we can avoid a race
    // condition with possible new incoming messages.
    // We want the most recent cached message, otherwise we would query with
    // the wrong `start` value. This function used to call
    // `api.disco.supports`, but it's also called in `fetchArchivedMessages`,
    // so it's not necessary here.
    const most_recent_msg = model.getMostRecentMessage();
    const should_page = api.settings.get('mam_request_all_pages') ? 'backwards' : false;

    if (most_recent_msg) {
        return fetchArchivedMessages(
            model,
            { mam: { start: most_recent_msg.get('time') }, rsm: { before: '' } },
            should_page,
        );
    } else {
        return fetchArchivedMessages(model, { rsm: { before: '' } }, should_page);
    }
}

/**
 * Searches the archive for messages whose text matches `text` (XEP-0431), and
 * holds the ones found in their conversations, so that they're messages like
 * any other: they can be read, replied to and reacted to.
 *
 * A match is left out if it has no conversation to be held in: one in a room
 * we aren't in, a private message in a room (XEP-0045), or one in a chat we
 * don't have, unless `create` is set.
 * @param {string} text
 * @param {Object} [options]
 * @param {string} [options.with] - The bare JID of a contact or room, to search only that conversation
 * @param {number} [options.max] - The most matches to return, the newest
 * @param {boolean} [options.create] - Whether to create the chats that matches are in, if we don't have them
 * @returns {Promise<{messages: import('../../shared/message.js').default[], complete: boolean}|null>}
 *  The matches, oldest first, or null if the server can't search its archive. Throws if the query fails.
 */
export async function searchArchive(
    text,
    { with: jid, max = api.settings.get('archived_messages_page_size'), create = false } = {},
) {
    if (!api.connection.connected()) return null;

    const bare_jid = _converse.session.get('bare_jid');
    const room = jid ? await api.rooms.get(jid) : undefined;
    const archive_jid = room ? jid : bare_jid;
    const supported =
        (await api.disco.supports(NS.MAM, archive_jid)) && (await api.disco.supports(NS.FULLTEXT, archive_jid));
    if (!supported) return null;

    const query = {
        is_groupchat: !!room,
        mam: { fulltext: text, with: jid },
        rsm: { max, before: '' },
    };
    const result = await api.archive.query(query);
    if (result.error) throw result.error;

    // Each match belongs to the conversation the other party of it is in.
    /** @type {Map<string, { is_room: boolean, matches: { archive_id: string, stanza: Element }[] }>} */
    const conversations = new Map();
    for (const stanza of result.messages) {
        const forwarded = sizzle(`[xmlns="${NS.MAM}"] > forwarded[xmlns="${NS.FORWARD}"] > message`, stanza).pop();
        // A malformed result is left out, rather than failing the whole search.
        if (!forwarded) continue;

        const from = Strophe.getBareJidFromJid(forwarded.getAttribute('from'));
        const to = Strophe.getBareJidFromJid(forwarded.getAttribute('to'));
        const is_room = forwarded.getAttribute('type') === 'groupchat';
        // A private message in a room is with an occupant, not a chat with the room's JID.
        if (!is_room && sizzle(`x[xmlns="${NS.MUC_USER}"]`, forwarded).length) continue;

        const conversation = is_room ? from : from === bare_jid ? to : from;

        const archive_id = sizzle(`[xmlns="${NS.MAM}"]`, stanza).pop()?.getAttribute('id');
        const group = conversations.get(conversation) ?? { is_room, matches: [] };
        group.matches.push({ archive_id, stanza });
        conversations.set(conversation, group);
    }

    /** @type {Map<string, import('../../shared/message.js').default>} */
    const held = new Map();
    for (const [conversation, { is_room, matches }] of conversations) {
        const model = is_room ? await api.rooms.get(conversation) : await api.chats.get(conversation, {}, create);
        if (!model) continue;

        await model.messages.fetched;
        const held_before = new Set(model.messages.models);
        await handleMAMResult(model, { messages: matches.map((m) => m.stanza) }, query, {}, false);
        await model.msg_chain;

        // Held under the archive's id, which is the stanza-id by the account, or by the room.
        // A match that's a correction is held as the message it corrects.
        const added = new Set();
        for (const { archive_id } of matches) {
            const message = archive_id && findByArchiveID(model, archive_id);
            if (!message) continue;

            held.set(archive_id, message);
            if (!held_before.has(message)) added.add(message);
        }
        addPlaceholdersAround(model, [...added]);
    }

    // The archive's order is kept, and matches with no conversation to be held in are left out.
    // A message is returned once, even if more than one version of it matched.
    const messages = result.messages
        .map((stanza) => sizzle(`[xmlns="${NS.MAM}"]`, stanza).pop()?.getAttribute('id'))
        .map((archive_id) => held.get(archive_id))
        .filter(Boolean);
    return { messages: [...new Set(messages)], complete: !!result.complete };
}
