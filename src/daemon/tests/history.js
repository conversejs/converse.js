/**
 * Reading history beyond what's stored locally, from a mocked server archive.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { converse } from '@converse/headless';
import { ERRORS } from '../protocol.js';
import { JID, startDaemon } from './harness.js';

const { Strophe, stx, u } = converse.env;

const OWN = 'romeo@montague.lit';
const JULIET = 'juliet@capulet.lit';
const TYBALT = 'tybalt@capulet.lit';
const HALL = 'hall@conference.montague.lit';

/**
 * Messages from `from` to us, one a minute, with ids `${prefix}1`, `${prefix}2`, ...
 * @param {string} from
 * @param {string} prefix
 * @param {number} count
 */
function archiveOf(from, prefix, count) {
    return Array.from({ length: count }, (_, i) => ({
        id: `${prefix}${i + 1}`,
        from,
        to: OWN,
        body: `Message ${i + 1}`,
        time: new Date(Date.UTC(2026, 9, 1, 10, i)).toISOString(),
    }));
}

describe('Reading history', () => {
    let daemon, client;

    /**
     * @param {Parameters<typeof startDaemon>[0]} options
     */
    async function start(options) {
        daemon = await startDaemon({
            roster: [{ jid: JULIET, name: 'Juliet' }],
            // Small pages, so that a few messages span several.
            settings: { archived_messages_page_size: '3' },
            ...options,
        });
        client = await daemon.connect();
    }

    afterEach(async () => {
        client?.close();
        await daemon?.stop();
        daemon = client = undefined;
    });

    /**
     * @param {Object} params
     */
    const ids = async (params) =>
        (await client.request('messages.list', { conversation: JULIET, ...params })).messages.map((m) => m.id);

    it('comes from the archive for a conversation not held locally', async () => {
        await start({ archive: archiveOf(JULIET, 'a', 7) });
        const { messages } = await client.request('messages.list', { conversation: JULIET, limit: 3 });
        expect(messages).toEqual(
            ['a5', 'a6', 'a7'].map((id, i) => ({
                id,
                conversation: JULIET,
                from: JULIET,
                nick: null,
                direction: 'incoming',
                time: new Date(Date.UTC(2026, 9, 1, 10, 4 + i)).toISOString(),
                body: `Message ${5 + i}`,
                encryption: null,
                reply_to: null,
                edited: null,
                retracted: null,
                reactions: {},
                status: 'received',
                error_code: null,
            })),
        );
    });

    it('pages back past the oldest local message into the archive, until it runs out', async () => {
        await start({ archive: archiveOf(JULIET, 'a', 7) });
        expect(await ids({ limit: 3 })).toEqual(['a5', 'a6', 'a7']);
        expect(await ids({ limit: 3, before: 'a5' })).toEqual(['a2', 'a3', 'a4']);
        expect(await ids({ limit: 3, before: 'a2' })).toEqual(['a1']);
        expect(await ids({ limit: 10 })).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7']);

        // The archive has said there's nothing older, so it isn't asked again.
        const queries = daemon.mam_queries.length;
        expect(await ids({ limit: 3, before: 'a1' })).toEqual([]);
        expect(await ids({ limit: 50 })).toHaveLength(7);
        expect(daemon.mam_queries.length).toBe(queries);
    });

    it("pages back through a room's archive by the ids the room gave its messages, until it runs out", async () => {
        const archive = archiveOf(`${HALL}/tybalt`, 'h', 7);
        await start({ room_archives: { [HALL]: archive }, rooms: [{ jid: HALL, nick: 'claude' }] });
        await daemon.enterRoom(HALL);
        // Entering fetches the newest page.
        const room = await daemon.api.rooms.get(HALL);
        await u.waitUntil(() => room.messages.length >= 3);
        const room_ids = async (params) =>
            (await client.request('messages.list', { conversation: HALL, ...params })).messages.map((m) => m.id);

        const queries = daemon.mam_queries.length;
        expect(await room_ids({ limit: 3 })).toEqual(['h5', 'h6', 'h7']);
        expect(await room_ids({ limit: 3, before: 'h5' })).toEqual(['h2', 'h3', 'h4']);
        expect(await room_ids({ limit: 3, before: 'h2' })).toEqual(['h1']);
        const befores = daemon.mam_queries.slice(queries).map((q) => q.querySelector('set > before')?.textContent);
        expect(befores).toEqual(['h5', 'h2', 'h1']);

        // The archive has said there's nothing older, so it isn't asked again.
        expect(await room_ids({ limit: 50 })).toHaveLength(7);
        expect(daemon.mam_queries.length).toBe(queries + 3);
    });

    it('stops paging back by time once the archive has nothing older than the oldest message held', async () => {
        const archive = [];
        await start({ archive });
        const chat = await daemon.api.chats.get(JULIET, {}, true);
        // Opening it fetches the newest page, of which there's none yet.
        await u.waitUntil(() => daemon.mam_queries.length > 0);
        await chat.msg_chain;
        // What we sent gets no stanza-id from our archive until it's fetched from there.
        const sent = await chat.sendMessage({ body: 'Hello' });
        archive.push({
            id: 'a1',
            from: JID,
            to: JULIET,
            body: 'Hello',
            time: sent.get('time'),
            origin_id: sent.get('origin_id'),
        });

        const queries = daemon.mam_queries.length;
        expect(await ids({ limit: 10 })).toHaveLength(1);
        expect(daemon.mam_queries.length).toBe(queries + 1);
        expect(await ids({ limit: 10 })).toHaveLength(1);
        expect(daemon.mam_queries.length).toBe(queries + 1);
    });

    it("doesn't duplicate a message that arrived live and is also in the archive", async () => {
        const archive = archiveOf(JULIET, 'x', 3);
        await start({ archive });
        const live = archive.at(-1);
        const { promise, resolve } = Promise.withResolvers();
        daemon.api.listen.once('message', resolve);
        daemon.receive(stx`
            <message xmlns="jabber:client" from="${JULIET}/balcony" to="${JID}" type="chat" id="live-1">
                <body>${live.body}</body>
                <stanza-id xmlns="${Strophe.NS.SID}" id="${live.id}" by="${OWN}"/>
                <delay xmlns="urn:xmpp:delay" stamp="${live.time}"/>
            </message>`);
        await promise;

        expect(await ids({ limit: 10 })).toEqual(['x1', 'x2', 'x3']);
    });

    it('stops at --since without asking the archive for anything older', async () => {
        const archive = archiveOf(JULIET, 'a', 7);
        await start({ archive });
        expect(await ids({ limit: 10, since: archive[5].time })).toEqual(['a6', 'a7']);
        // Opening the conversation fetches its newest page (headless does so
        // too, by itself), but nothing pages back from there.
        const befores = daemon.mam_queries.map((q) => q.querySelector('set > before')?.textContent);
        expect(befores.length).toBeGreaterThan(0);
        expect(befores.every((b) => b === '')).toBe(true);
    });

    it("reads the archived history of someone who isn't a contact", async () => {
        await start({ archive: archiveOf(TYBALT, 't', 2) });
        const { conversation, messages } = await client.request('messages.list', { conversation: TYBALT });
        expect(conversation).toEqual({ jid: TYBALT, type: 'chat', name: null });
        expect(messages.map((m) => m.body)).toEqual(['Message 1', 'Message 2']);
    });

    it("doesn't open a conversation with a stranger the archive knows nothing of", async () => {
        await start({ archive: [] });
        const sent = daemon.connection.sent_stanzas.length;
        await expect(client.request('messages.list', { conversation: TYBALT })).rejects.toMatchObject({
            code: ERRORS.NOT_FOUND,
        });
        expect(await daemon.api.chats.get(TYBALT)).toBeNull();
        expect(daemon.connection.sent_stanzas.slice(sent).filter((s) => s.getAttribute('to') === TYBALT)).toEqual([]);
    });

    it('asks the archive again after a failed query, rather than concluding there is nothing older', async () => {
        await start({ archive: archiveOf(JULIET, 'a', 7), mam_mode: 'error' });
        expect(await ids({ limit: 3 })).toEqual([]);

        daemon.setMAMMode('answer');
        expect(await ids({ limit: 3 })).toEqual(['a5', 'a6', 'a7']);
    });

    it('gives up on an archive that never answers after one query, instead of retrying until it does', async () => {
        await start({
            archive: archiveOf(JULIET, 'a', 7),
            mam_mode: 'silent',
            settings: { archived_messages_page_size: '3', message_archiving_timeout: 50 },
        });
        const queries = daemon.mam_queries.length;
        expect(await ids({ limit: 3 })).toEqual([]);
        // One query to open the conversation and one for the page before it.
        expect(daemon.mam_queries.length - queries).toBeLessThanOrEqual(3);
    });

    it("says the daemon is offline, not that there's no history, for a stranger while disconnected", async () => {
        await start({ archive: archiveOf(TYBALT, 't', 2) });
        const connected = vi.spyOn(daemon.api.connection, 'connected').mockReturnValue(false);
        try {
            await expect(client.request('messages.list', { conversation: TYBALT })).rejects.toMatchObject({
                code: ERRORS.NOT_CONNECTED,
            });
        } finally {
            connected.mockRestore();
        }
    });
});
