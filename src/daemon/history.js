/**
 * A page of a conversation's history, from the local store and, where that
 * falls short, the server's archive (XEP-0313 MAM).
 *
 * Headless does the archive work: queries, paging, parsing and recognising
 * messages it already has. It also marks the stretches of history it hasn't
 * fetched with placeholder messages. What's here only decides when a page
 * needs one of those filled, or needs more history from before the oldest
 * message held.
 * @module @converse/daemon/history
 */
import { _converse, api, converse, MAMPlaceholderMessage } from '@converse/headless';

const { Strophe, u } = converse.env;

/**
 * An upper bound on archive queries per page, so that a misbehaving server
 * can't keep a request going forever.
 */
const MAX_FETCHES = 10;

/**
 * Conversations whose archive has nothing older than what's held locally.
 * Older history doesn't appear later, so they're never asked again.
 * @type {WeakSet<import('@converse/headless').ChatBox>}
 */
const exhausted = new WeakSet();

/**
 * The newest `limit` messages that are older than `before` (if given) and no
 * older than `since` (if given), fetching from the archive what's missing.
 * @param {import('@converse/headless').ChatBox} chat
 * @param {Object} options
 * @param {number} options.limit
 * @param {(messages: import('@converse/headless').Message[]) => import('@converse/headless').Message} [options.before]
 *  Finds the message the page ends before, or throws.
 * @param {number} [options.since] - Milliseconds since the epoch
 * @returns {Promise<import('@converse/headless').Message[]>} Oldest first
 */
export async function getPage(chat, { limit, before, since }) {
    await chat.messages.fetched;
    for (let fetches = 0; ; fetches++) {
        const { page, gap, reached_start } = collect(chat, { limit, before, since });
        if (fetches === MAX_FETCHES) return page;

        if (gap) {
            await gap.fetchMissingMessages();
        } else if (reached_start && !exhausted.has(chat)) {
            const oldest = chat.getOldestMessage();
            const result = await fetchOlder(chat, oldest);
            await chat.msg_chain;
            // Only an answer from the archive says whether there's anything older.
            // If the query failed or wasn't made, the question stays open for the next read.
            if (!result || result.error) return page;
            // Paging by time, the answer includes the messages sent when the oldest
            // was, itself among them. So only one that brings an older message says
            // there may be more.
            const by_time = oldest && !oldest.getArchiveID();
            if (result.messages.length === 0 || (by_time && chat.getOldestMessage() === oldest)) {
                exhausted.add(chat);
            }
        } else {
            return page;
        }
        await chat.msg_chain;
    }
}

/**
 * Whether the server's archive holds any message exchanged with `jid`, so
 * that reading the history of someone who isn't a contact needn't open a
 * conversation with them to find out.
 * @param {string} jid
 */
export async function hasArchivedMessages(jid) {
    const own_jid = _converse.session.get('bare_jid');
    if (!api.connection.connected() || !(await api.disco.supports(Strophe.NS.MAM, own_jid))) {
        return false;
    }
    try {
        const result = await api.archive.query({ mam: { with: jid }, rsm: { max: 1, before: '' } });
        return result.messages.length > 0;
    } catch {
        return false;
    }
}

/**
 * Walks back from the end of the page, collecting messages until there are
 * enough, or it meets a stretch of history that hasn't been fetched, or it
 * runs out.
 * @param {import('@converse/headless').ChatBox} chat
 * @param {Object} options
 * @param {number} options.limit
 * @param {Function} [options.before]
 * @param {number} [options.since]
 */
function collect(chat, { limit, before, since }) {
    const models = chat.messages.models;
    const end = before ? models.indexOf(before(models.filter(isMessage))) : models.length;
    const page = [];
    for (let i = end - 1; i >= 0; i--) {
        const model = models[i];
        if (since !== undefined && Date.parse(model.get('time')) < since) {
            return { page, gap: null, reached_start: false };
        }
        if (model instanceof MAMPlaceholderMessage) {
            return { page, gap: model, reached_start: false };
        }
        if (isMessage(model)) {
            page.unshift(model);
            if (page.length === limit) return { page, gap: null, reached_start: false };
        }
    }
    return { page, gap: null, reached_start: true };
}

/**
 * @param {import('@converse/headless').Message} model
 */
export function isMessage(model) {
    if (model instanceof MAMPlaceholderMessage) return false;
    // A retraction or reaction whose target hasn't arrived is held until it does. It's not a message.
    if (model.get('dangling_retraction') || model.get('dangling_reaction')) return false;
    // A message that couldn't be decrypted has no body, but the user still needs to see that it arrived.
    return !!model.get('body') || isUndecryptable(model);
}

/**
 * Fetches the archive's page of history from before the oldest message held.
 * @param {import('@converse/headless').ChatBox} chat
 * @param {import('@converse/headless').Message} [oldest]
 */
function fetchOlder(chat, oldest) {
    const archive_id = oldest?.getArchiveID();
    if (archive_id) {
        return u.mam.fetchArchivedMessages(chat, { rsm: { before: archive_id } });
    } else if (oldest) {
        // Not from the archive, so there's no archive id to page from: page
        // back from its time instead.
        return u.mam.fetchArchivedMessages(chat, { mam: { end: oldest.get('time') }, rsm: { before: '' } });
    }
    return u.mam.fetchArchivedMessages(chat, { rsm: { before: '' } });
}

/**
 * Whether a message arrived OMEMO-encrypted and couldn't be decrypted.
 * @param {import('@converse/headless').Message} message
 */
export function isUndecryptable(message) {
    return !!message.get('is_error') && message.get('error_type') === 'Decryption';
}
