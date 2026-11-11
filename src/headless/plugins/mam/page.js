/**
 * @typedef {import('../chat/model').default} ChatBox
 * @typedef {import('../muc/muc').default} MUC
 * @typedef {import('../../shared/message').default} BaseMessage
 */
import api from '../../shared/api/index.js';
import MAMPlaceholderMessage from './placeholder.js';
import { fetchArchivedMessages } from './utils.js';

/**
 * An upper bound on archive queries per page, so that a misbehaving server
 * can't keep a request going forever.
 */
const MAX_FETCHES = 10;

/**
 * Conversations whose archive has nothing older than what's held locally.
 * Older history doesn't appear later, so they're never asked again.
 * @type {WeakSet<ChatBox|MUC>}
 */
const exhausted = new WeakSet();

/**
 * @param {BaseMessage} model
 */
const isNotPlaceholder = (model) => !(model instanceof MAMPlaceholderMessage);

/**
 * The newest `limit` messages of a conversation that are older than `before`
 * (if given) and no older than `since` (if given), fetching from the archive
 * whatever of that stretch isn't held locally.
 * @param {ChatBox|MUC} chat
 * @param {import('./types').ArchivePageOptions} options
 * @returns {Promise<BaseMessage[]>} Oldest first
 */
export async function getPage(chat, { limit, before, since, filter = isNotPlaceholder }) {
    await chat.messages.fetched;
    for (let fetches = 0; ; fetches++) {
        const { page, gap, reached_start } = collect(chat, { limit, before, since, filter });
        if (fetches === MAX_FETCHES) return page;
        // There's no archive to fetch from until we're logged in, for example
        // while a session loaded from the cache is still connecting.
        if (!api.connection.authenticated()) return page;

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
 * Walks back from the end of the page, collecting messages until there are
 * enough, or it meets a stretch of history that hasn't been fetched, or it
 * runs out.
 * @param {ChatBox|MUC} chat
 * @param {import('./types').ArchivePageOptions} options
 */
function collect(chat, { limit, before, since, filter }) {
    const models = chat.messages.models;
    const end = before ? models.indexOf(before) : models.length;
    const page = [];
    // The message the page ends before has gone, so there's no page to fill.
    if (end === -1) return { page, gap: null, reached_start: false };

    for (let i = end - 1; i >= 0; i--) {
        const model = models[i];
        if (since !== undefined && Date.parse(model.get('time')) < since) {
            return { page, gap: null, reached_start: false };
        }
        if (model instanceof MAMPlaceholderMessage) {
            return { page, gap: model, reached_start: false };
        }
        if (filter(model)) {
            page.unshift(model);
            if (page.length === limit) return { page, gap: null, reached_start: false };
        }
    }
    return { page, gap: null, reached_start: true };
}

/**
 * Fetches the archive's page of history from before the oldest message held.
 * @param {ChatBox|MUC} chat
 * @param {BaseMessage} [oldest]
 */
function fetchOlder(chat, oldest) {
    const archive_id = oldest?.getArchiveID();
    if (archive_id) {
        return fetchArchivedMessages(chat, { rsm: { before: archive_id } });
    } else if (oldest) {
        // Not from the archive, so there's no archive id to page from: page
        // back from its time instead.
        return fetchArchivedMessages(chat, { mam: { end: oldest.get('time') }, rsm: { before: '' } });
    }
    return fetchArchivedMessages(chat, { rsm: { before: '' } });
}
