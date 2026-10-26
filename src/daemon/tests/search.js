/**
 * Searching messages: on the server's archive (XEP-0431) where it offers
 * full-text search, and in the messages held locally where it doesn't.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { converse } from '@converse/headless';
import { ERRORS } from '../protocol.js';
import { JID, startDaemon } from './harness.js';

const { Strophe, stx } = converse.env;

const OWN = 'romeo@montague.lit';
const JULIET = 'juliet@capulet.lit';
const TYBALT = 'tybalt@capulet.lit';

/** The archive, oldest first, one message a minute from 10:00. */
const ARCHIVE = [
    { id: 'a1', from: JULIET, to: OWN, body: 'Meet me at the balcony', minute: 0 },
    { id: 'a2', from: JULIET, to: OWN, body: 'Is it lunch yet?', minute: 1 },
    { id: 't1', from: TYBALT, to: OWN, body: 'The balcony is ours', minute: 2 },
    { id: 'a3', from: OWN, to: JULIET, body: 'Balcony at dusk, then', minute: 3 },
    { id: 'a4', from: JULIET, to: OWN, body: 'Dusk it is', minute: 4 },
].map(({ minute, ...message }) => ({
    ...message,
    time: new Date(Date.UTC(2026, 9, 1, 10, minute)).toISOString(),
}));

describe('Searching messages', () => {
    let daemon, client;

    /**
     * @param {Parameters<typeof startDaemon>[0]} [options]
     */
    async function start(options = {}) {
        daemon = await startDaemon({
            roster: [
                { jid: JULIET, name: 'Juliet' },
                { jid: 'mercutio@montague.lit', name: 'Mercutio' },
            ],
            archive: ARCHIVE,
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
    const search = (params) => client.request('messages.search', params);
    /** @param {{ messages: { id: string }[] }} result */
    const ids = (result) => result.messages.map((m) => m.id);

    describe('on the server', () => {
        it('finds the archived messages with every word, across conversations, oldest first', async () => {
            await start();
            const result = await search({ query: 'balcony' });

            expect(result.method).toBe('server');
            expect(ids(result)).toEqual(['a1', 't1', 'a3']);
            expect(result.messages.map((m) => m.conversation)).toEqual([JULIET, TYBALT, JULIET]);
            expect(result.messages[2]).toMatchObject({
                id: 'a3',
                conversation: JULIET,
                from: OWN,
                direction: 'outgoing',
                body: 'Balcony at dusk, then',
            });
            expect(ids(await search({ query: 'DUSK then' }))).toEqual(['a3']);
        });

        it('searches one conversation when one is named, by JID or by contact name', async () => {
            await start();
            expect(ids(await search({ query: 'balcony', conversation: JULIET }))).toEqual(['a1', 'a3']);
            expect(ids(await search({ query: 'balcony', conversation: 'Juliet' }))).toEqual(['a1', 'a3']);
        });

        it('returns the newest matches when there are more than the limit', async () => {
            await start();
            expect(ids(await search({ query: 'balcony', limit: 2 }))).toEqual(['t1', 'a3']);
        });

        it('holds the matches as messages, so that their ids work with the other commands', async () => {
            await start();
            const [found] = (await search({ query: 'Meet me', conversation: JULIET })).messages;
            expect(found.id).toBe('a1');

            const reacted = await client.request('messages.react', { id: found.id, emoji: '👍' });
            expect(reacted).toMatchObject({ outcome: 'sent', message: { id: 'a1', reactions: { '👍': [OWN] } } });
        });

        it('finds nothing, without failing, when nothing matches', async () => {
            await start();
            expect(await search({ query: 'hamlet' })).toEqual({ method: 'server', messages: [] });
        });

        it('searches the messages held locally when the server has no full-text search', async () => {
            await start({ fulltext: false });
            const result = await search({ query: 'balcony' });
            expect(result.method).toBe('local');
            // The archive isn't searched, and nothing has been held locally yet.
            expect(ids(result)).toEqual([]);
        });

        it('searches the messages held locally when the server answers the search with an error', async () => {
            await start({ mam_mode: 'error' });
            expect(await search({ query: 'balcony' })).toEqual({ method: 'local', messages: [] });
        });
    });

    describe('in the messages held locally', () => {
        it('finds messages received while the daemon ran, ignoring case and accents', async () => {
            await start({ fulltext: false });
            const { promise, resolve } = Promise.withResolvers();
            daemon.api.listen.once('message', resolve);
            daemon.receive(stx`
                <message xmlns="jabber:client" from="${JULIET}/balcony" to="${JID}" type="chat" id="live-1">
                    <body>Café on the BALCONY?</body>
                    <stanza-id xmlns="${Strophe.NS.SID}" id="live-id-1" by="${OWN}"/>
                </message>`);
            await promise;

            const result = await search({ query: 'cafe balcony' });
            expect(result.method).toBe('local');
            expect(result.messages).toMatchObject([
                { id: 'live-id-1', conversation: JULIET, body: 'Café on the BALCONY?' },
            ]);
            expect(ids(await search({ query: 'cafe lunch' }))).toEqual([]);
        });
    });

    describe('input', () => {
        it('refuses an empty query', async () => {
            await start();
            await expect(search({ query: '   ' })).rejects.toMatchObject({ code: ERRORS.INVALID_PARAMS });
        });

        it('refuses a limit that is not a whole number from 1 up', async () => {
            await start();
            await expect(search({ query: 'balcony', limit: 0 })).rejects.toMatchObject({
                code: ERRORS.INVALID_PARAMS,
            });
        });

        it('refuses a conversation named as a contact that the roster has no one by', async () => {
            await start();
            await expect(search({ query: 'balcony', conversation: 'Nobody' })).rejects.toMatchObject({
                code: ERRORS.NOT_FOUND,
            });
        });
    });
});
