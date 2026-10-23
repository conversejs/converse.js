/**
 * The daemon hosts headless under Node on the MockConnection that every other
 * daemon spec builds on. This pins that the mock works there at all.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { converse } from '@converse/headless';
import { JID, login } from './harness.js';

const { stx } = converse.env;

describe('Headless under Node, on the mock connection', () => {
    let session;

    beforeAll(async () => {
        session = await login({ roster: [{ jid: 'juliet@montague.lit', name: 'Juliet Capulet' }] });
    });

    afterAll(() => session?.logout());

    it('logs in as the configured JID', async () => {
        expect(session.api.connection.connected()).toBe(true);
        expect(session.api.connection.get().jid).toBe(JID);
        await expect(session.api.contacts.get('juliet@montague.lit')).resolves.toBeTruthy();
    });

    it('handles an injected message stanza', async () => {
        const { promise, resolve } = Promise.withResolvers();
        session.api.listen.once('message', resolve);

        session.receive(stx`
            <message xmlns="jabber:client" from="juliet@montague.lit/balcony" to="${JID}" type="chat" id="m1">
                <body>Wherefore art thou?</body>
            </message>`);

        const { chatbox } = await promise;
        expect(chatbox.get('jid')).toBe('juliet@montague.lit');
        expect(chatbox.messages.pluck('body')).toEqual(['Wherefore art thou?']);
    });
});
