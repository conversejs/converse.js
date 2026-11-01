/**
 * The daemon hosts headless under Node on the MockConnection that every other
 * daemon spec builds on. This pins that the mock works there at all.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { converse } from '@converse/headless';
import { JID, startDaemon } from './harness.js';

const { stx } = converse.env;

describe("The daemon's headless session, on the mock connection", () => {
    let daemon;

    beforeAll(async () => {
        daemon = await startDaemon({ roster: [{ jid: 'juliet@montague.lit', name: 'Juliet Capulet' }] });
    });

    afterAll(() => daemon?.stop());

    it('logs in as the configured account', async () => {
        expect(daemon.api.connection.connected()).toBe(true);
        expect(daemon.api.connection.get().jid).toBe(JID);
        await expect(daemon.api.contacts.get('juliet@montague.lit')).resolves.toBeTruthy();
    });

    it('handles an injected message stanza', async () => {
        const { promise, resolve } = Promise.withResolvers();
        daemon.api.listen.once('message', resolve);

        daemon.receive(stx`
            <message xmlns="jabber:client" from="juliet@montague.lit/balcony" to="${JID}" type="chat" id="m1">
                <body>Wherefore art thou?</body>
            </message>`);

        const { chatbox } = await promise;
        expect(chatbox.get('jid')).toBe('juliet@montague.lit');
        expect(chatbox.messages.pluck('body')).toEqual(['Wherefore art thou?']);
    });
});
