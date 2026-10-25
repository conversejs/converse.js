import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { converse } from '@converse/headless';
import { ERRORS } from '../protocol.js';
import { JID, startDaemon } from './harness.js';

const { stx } = converse.env;

const JULIET = 'juliet@capulet.lit';
const MERCUTIO = 'mercutio@montague.lit';
const STRANGER = 'stranger@example.org';

/**
 * Polls until `check` gives a truthy value. Lookups are async, so a condition
 * can't be waited for with `u.waitUntil`, which checks synchronously.
 * @param {() => Promise<unknown>} check
 */
async function eventually(check) {
    for (let i = 0; i < 100; i++) {
        if (await check()) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('The condition never held');
}

describe('Contacts', () => {
    let daemon, client;

    beforeAll(async () => {
        daemon = await startDaemon({
            roster: [
                { jid: JULIET, name: 'Juliet Capulet' },
                { jid: MERCUTIO, name: 'Mercutio' },
            ],
        });
        client = await daemon.connect();
    });

    afterAll(async () => {
        vi.restoreAllMocks();
        client?.close();
        await daemon?.stop();
    });

    /** @param {string} [query] */
    const list = (query) => client.request('contacts.list', query === undefined ? {} : { query });

    it('lists the roster by name, with each contact offline until they say otherwise', async () => {
        const { contacts } = await list();
        expect(contacts).toEqual([
            { jid: JULIET, name: 'Juliet Capulet', presence: 'offline' },
            { jid: MERCUTIO, name: 'Mercutio', presence: 'offline' },
        ]);
    });

    it('filters by a query matching the name or the JID, ignoring case', async () => {
        expect((await list('CAPULET')).contacts.map((c) => c.jid)).toEqual([JULIET]);
        expect((await list('montague.lit')).contacts.map((c) => c.jid)).toEqual([MERCUTIO]);
        expect((await list('nobody')).contacts).toEqual([]);
    });

    it('refuses a query that is not text', async () => {
        await expect(list(7)).rejects.toMatchObject({ code: ERRORS.INVALID_PARAMS });
    });

    it('shows a contact as online once they are, from the presence they send', async () => {
        daemon.receive(stx`
            <presence xmlns="jabber:client" from="${JULIET}/balcony" to="${JID}">
                <show>chat</show>
            </presence>`);
        await eventually(async () => (await list('juliet')).contacts[0]?.presence === 'chat');
    });
});

describe('Whois', () => {
    let daemon, client;

    beforeAll(async () => {
        daemon = await startDaemon({ roster: [{ jid: JULIET, name: 'Juliet Capulet' }] });
        client = await daemon.connect();
        vi.spyOn(daemon.api.vcard, 'get').mockImplementation((jid) =>
            jid === JULIET
                ? { fullname: 'Juliet Capulet', email: 'juliet@example.net', url: null, role: null, nickname: 'Jules' }
                : { vcard_error: 'item-not-found', error: 'item-not-found' },
        );
        // Each client's disco#info, as an entity: the identities it advertises.
        const entities = {
            [`${JULIET}/balcony`]: [{ category: 'client', type: 'phone', name: 'Conversations' }],
        };
        const { get: getEntity } = daemon.api.disco.entities;
        vi.spyOn(daemon.api.disco.entities, 'get').mockImplementation((jid, create) => {
            if (!(jid in entities)) return getEntity(jid, create);
            return {
                waitUntilFeaturesDiscovered: Promise.resolve(),
                identities: {
                    models: entities[jid].map((identity) => ({ get: (key) => identity[key] })),
                },
            };
        });
        daemon.receive(stx`
            <presence xmlns="jabber:client" from="${JULIET}/balcony" to="${JID}">
                <show>away</show>
                <status>On the balcony</status>
                <priority>5</priority>
            </presence>`);
        await eventually(async () => (await client.request('contacts.whois', { jid: JULIET })).resources.length === 1);
    });

    afterAll(async () => {
        vi.restoreAllMocks();
        client?.close();
        await daemon?.stop();
    });

    it('shows a roster contact with their vCard and the clients they are connected with', async () => {
        const details = await client.request('contacts.whois', { jid: 'Juliet Capulet' });
        expect(details).toEqual({
            jid: JULIET,
            name: 'Juliet Capulet',
            on_roster: true,
            presence: 'away',
            vcard: {
                fullname: 'Juliet Capulet',
                nickname: 'Jules',
                email: 'juliet@example.net',
                url: null,
                role: null,
            },
            resources: [
                {
                    name: 'balcony',
                    presence: 'away',
                    priority: 5,
                    status: 'On the balcony',
                    identities: [{ category: 'client', type: 'phone', name: 'Conversations' }],
                },
            ],
        });
    });

    it('shows a stranger, who is not on the roster, with no vCard and no clients', async () => {
        expect(await client.request('contacts.whois', { jid: STRANGER })).toEqual({
            jid: STRANGER,
            name: null,
            on_roster: false,
            presence: 'offline',
            vcard: null,
            resources: [],
        });
    });

    it('refuses a name that matches nobody, pointing at the contacts command', async () => {
        const error = await client.request('contacts.whois', { jid: 'Paris' }).catch((e) => e);
        expect(error).toMatchObject({ code: ERRORS.NOT_FOUND });
        expect(error.message).toContain('converse-cli contacts');
    });
});
