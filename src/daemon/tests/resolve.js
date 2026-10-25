import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ERRORS } from '../protocol.js';
import { startDaemon } from './harness.js';

const JULIET = 'juliet@capulet.lit';
const MERCUTIO = 'mercutio@montague.lit';
const BENVOLIO = 'benvolio@montague.lit';
const TYBALT = 'tybalt@capulet.lit';
const TYBALT_TWIN = 'tybalt.twin@capulet.lit';

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
        expect(error.message).toContain('converse-cli contacts');
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
