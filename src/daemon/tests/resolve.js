import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { converse } from '@converse/headless';
import { ERRORS } from '../protocol.js';
import { startDaemon } from './harness.js';

const { Strophe, u } = converse.env;

const JULIET = 'juliet@capulet.lit';
const MERCUTIO = 'mercutio@montague.lit';
const BENVOLIO = 'benvolio@montague.lit';
const TYBALT = 'tybalt@capulet.lit';
const TYBALT_TWIN = 'tybalt.twin@capulet.lit';
const ROOM = 'garden@conference.montague.lit';

describe('Names given for a conversation or contact', () => {
    let daemon, client;

    beforeAll(async () => {
        daemon = await startDaemon({
            roster: [
                { jid: JULIET, name: 'Juliet Capulet' },
                { jid: MERCUTIO, name: 'Mercutio' },
                { jid: BENVOLIO, name: 'Benvolio' },
                { jid: TYBALT, name: 'Tybalt' },
                { jid: TYBALT_TWIN, name: 'Tybalt' },
            ],
        });
        client = await daemon.connect();
    });

    afterAll(async () => {
        client?.close();
        await daemon?.stop();
    });

    /** @param {string} conversation */
    const list = (conversation) => client.request('messages.list', { conversation });

    it('resolves a contact by roster name, ignoring case', async () => {
        expect((await list('mercutio')).conversation.jid).toBe(MERCUTIO);
        expect((await list('JULIET CAPULET')).conversation.jid).toBe(JULIET);
    });

    it('takes an exact JID as it is, whatever its case, and whether or not it is on the roster', async () => {
        expect((await list('Juliet@Capulet.lit')).conversation.jid).toBe(JULIET);
        // Not a contact, so the lookup fails, but it names the JID it looked for.
        const error = await list('Stranger@example.org').catch((e) => e);
        expect(error).toMatchObject({ code: ERRORS.NOT_FOUND });
        expect(error.message).toContain('stranger@example.org');
    });

    it('fails with the candidates when a name matches more than one contact', async () => {
        const error = await list('Tybalt').catch((e) => e);
        expect(error).toMatchObject({ code: ERRORS.AMBIGUOUS });
        expect(error.data.candidates).toHaveLength(2);
        expect(error.data.candidates).toEqual(
            expect.arrayContaining([`Tybalt <${TYBALT}>`, `Tybalt <${TYBALT_TWIN}>`]),
        );
    });

    it('fails with NOT_FOUND, pointing at the contacts command, when no contact has the name', async () => {
        const error = await list('Paris').catch((e) => e);
        expect(error).toMatchObject({ code: ERRORS.NOT_FOUND });
        expect(error.message).toContain('"contacts.list"');
    });

    it('refuses an empty name', async () => {
        await expect(list('   ')).rejects.toMatchObject({ code: ERRORS.INVALID_PARAMS });
    });

    it('resolves a name in an event subscription filter, and refuses one that matches nobody', async () => {
        const { subscription } = await client.request('events.subscribe', { from: 'Benvolio' });
        expect(subscription).toEqual(expect.any(Number));
        await client.request('events.unsubscribe', { subscription });

        await expect(client.request('events.subscribe', { from: 'Paris' })).rejects.toMatchObject({
            code: ERRORS.NOT_FOUND,
        });
    });
});

describe('A JID that is also the name of another contact', () => {
    const ROMEO = 'romeo@montague.lit';
    let daemon, client;

    beforeAll(async () => {
        daemon = await startDaemon({
            roster: [
                { jid: JULIET, name: 'Juliet Capulet' },
                // Romeo's contact is named with Juliet's JID, so the text could mean either.
                { jid: ROMEO, name: JULIET },
            ],
        });
        client = await daemon.connect();
    });

    afterAll(async () => {
        client?.close();
        await daemon?.stop();
    });

    it('refuses the text, with both candidates, rather than taking either', async () => {
        const error = await client.request('messages.list', { conversation: JULIET }).catch((e) => e);
        expect(error).toMatchObject({ code: ERRORS.AMBIGUOUS });
        expect(error.data.candidates).toEqual(expect.arrayContaining([JULIET, `${JULIET} <${ROMEO}>`]));
    });

    it('still takes a JID that no contact is named with', async () => {
        const { conversation } = await client.request('messages.list', { conversation: ROMEO });
        expect(conversation.jid).toBe(ROMEO);
    });
});

/** Keeps the daemon from connecting the next time it starts. */
const blockConnecting = () => vi.spyOn(Strophe.Connection.prototype, 'connect').mockImplementation(() => {});

describe('A daemon that has not connected since it started', () => {
    let daemon, client;

    beforeAll(async () => {
        daemon = await startDaemon({ roster: [{ jid: JULIET, name: 'Juliet Capulet' }] });
        blockConnecting();
        await daemon.restart({ offline: true });
        client = await daemon.connect();
    });

    afterAll(async () => {
        vi.restoreAllMocks();
        client?.close();
        await daemon?.stop();
    });

    it('refuses a name rather than saying nobody has it', async () => {
        const error = await client.request('events.subscribe', { from: 'Juliet Capulet' }).catch((e) => e);
        expect(error).toMatchObject({ code: ERRORS.NOT_CONNECTED });
        expect(error.message).toContain('Use a JID instead');
        for (const [method, params] of [
            ['contacts.whois', { jid: 'Juliet Capulet' }],
            ['contacts.list', {}],
            ['rooms.leave', { room: 'The Garden' }],
        ]) {
            await expect(client.request(method, params), method).rejects.toMatchObject({
                code: ERRORS.NOT_CONNECTED,
            });
        }
    });

    it('refuses what needs the conversations, rather than waiting for them', async () => {
        for (const [method, params] of [
            ['messages.list', { conversation: JULIET }],
            ['conversations.list', {}],
            ['inbox.read', {}],
            ['messages.search', { query: 'hello', conversation: JULIET }],
            ['messages.retract', { id: 'x', conversation: JULIET }],
            ['rooms.leave', { room: ROOM }],
            ['rooms.occupants', { room: ROOM }],
        ]) {
            await expect(client.request(method, params), method).rejects.toMatchObject({
                code: ERRORS.NOT_CONNECTED,
            });
        }
    });

    it('refuses an upload, rather than waiting for the upload service', async () => {
        const params = { to: JULIET, name: 'note.txt', content: 'aGk=' };
        await expect(client.request('files.upload', params)).rejects.toMatchObject({ code: ERRORS.NOT_CONNECTED });
    });
});

describe('A daemon that has connected, and is still loading', () => {
    const ROMEO = 'romeo@montague.lit';
    let daemon, client;

    beforeAll(async () => {
        daemon = await startDaemon({
            roster: [
                { jid: MERCUTIO, name: 'Mercutio' },
                { jid: ROMEO, name: JULIET },
            ],
        });
        blockConnecting();
        await daemon.restart({ offline: true });
        vi.restoreAllMocks();
        daemon.connectFirstTime();
        await u.waitUntil(() => daemon.api.connection.connected());
        client = await daemon.connect();
    });

    afterAll(async () => {
        client?.close();
        await daemon?.stop();
    });

    it('waits for the roster to answer for a name, or for a JID that may be one', async () => {
        const by_name = client.request('events.subscribe', { from: 'Mercutio' }).catch((e) => e);
        const by_jid = client.request('messages.list', { conversation: JULIET }).catch((e) => e);
        // Answered after the two above have reached the daemon.
        await client.request('daemon.status');

        await daemon.answerServer();

        expect((await by_name).subscription).toEqual(expect.any(Number));
        expect(await by_jid).toMatchObject({ code: ERRORS.AMBIGUOUS });
    });
});

describe('A daemon whose connection has dropped', () => {
    let daemon, client;

    beforeAll(async () => {
        daemon = await startDaemon({
            roster: [
                { jid: MERCUTIO, name: 'Mercutio' },
                { jid: TYBALT, name: 'Tybalt' },
                { jid: TYBALT_TWIN, name: 'Tybalt' },
            ],
        });
        client = await daemon.connect();
        const joined = client.request('rooms.join', { room: ROOM, nick: 'agent' });
        await daemon.enterRoom(ROOM);
        await joined;
        (await daemon.api.rooms.get(ROOM)).save('name', 'The Garden');
        vi.spyOn(daemon.api.connection, 'connected').mockReturnValue(false);
    });

    afterAll(async () => {
        vi.restoreAllMocks();
        client?.close();
        await daemon?.stop();
    });

    it('still goes by the names of the contacts and rooms it has loaded', async () => {
        expect((await client.request('messages.list', { conversation: 'Mercutio' })).conversation.jid).toBe(MERCUTIO);
        await expect(client.request('rooms.occupants', { room: 'the garden' })).resolves.toHaveProperty('occupants');
    });

    it('still refuses a name it can tell is ambiguous or unknown', async () => {
        const list = (conversation) => client.request('messages.list', { conversation });
        await expect(list('Tybalt')).rejects.toMatchObject({ code: ERRORS.AMBIGUOUS });
        await expect(list('Paris')).rejects.toMatchObject({ code: ERRORS.NOT_FOUND });
    });

    it('refuses an upload, since the server is needed for it', async () => {
        const params = { to: MERCUTIO, name: 'note.txt', content: 'aGk=' };
        await expect(client.request('files.upload', params)).rejects.toMatchObject({ code: ERRORS.NOT_CONNECTED });
    });
});
