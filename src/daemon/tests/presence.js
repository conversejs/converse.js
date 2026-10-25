import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ERRORS } from '../protocol.js';
import { startDaemon } from './harness.js';

describe('Setting our presence', () => {
    let daemon, full, restricted;

    beforeAll(async () => {
        daemon = await startDaemon();
        full = await daemon.connect({ access: 'full' });
        restricted = await daemon.connect({ access: 'restricted' });
    });

    afterAll(async () => {
        full?.close();
        restricted?.close();
        await daemon?.stop();
    });

    /** The presence stanzas the daemon has put on the wire, as {show, status} pairs. */
    const sent = () =>
        daemon.connection.sent_stanzas
            .filter((s) => s.nodeName === 'presence' && !s.getAttribute('type'))
            .map((s) => ({
                show: s.querySelector('show')?.textContent ?? null,
                status: s.querySelector('status')?.textContent ?? null,
            }));

    it('is refused to restricted access by default, and nothing goes out', async () => {
        const before = sent().length;
        await expect(restricted.request('presence.set', { show: 'chat' })).rejects.toMatchObject({
            code: ERRORS.ACCESS_DENIED,
            message: expect.stringContaining('"policy.presence"'),
        });
        expect(sent().length).toBe(before);
    });

    it('lets full access set it, and sends the presence to the server', async () => {
        const result = await full.request('presence.set', { show: 'chat', message: 'Reading the archive' });
        expect(result).toEqual({ show: 'chat', status_message: 'Reading the archive' });
        // The presence goes out as the profile changes, which is after the reply.
        await vi.waitFor(() => expect(sent()).toContainEqual({ show: 'chat', status: 'Reading the archive' }));
    });

    it('keeps the status message when none is given', async () => {
        expect(await full.request('presence.set', { show: 'dnd' })).toEqual({
            show: 'dnd',
            status_message: 'Reading the archive',
        });
    });

    it('refuses a show value that is not one of the choices', async () => {
        await expect(full.request('presence.set', { show: 'invisible' })).rejects.toMatchObject({
            code: ERRORS.INVALID_PARAMS,
            message: '"show" must be one of: online, chat, away, xa, dnd.',
        });
    });

    it('refuses a status message that is not text', async () => {
        await expect(full.request('presence.set', { show: 'chat', message: 3 })).rejects.toMatchObject({
            code: ERRORS.INVALID_PARAMS,
        });
    });
});

describe('Setting our presence, when the config allows restricted access to', () => {
    let daemon, restricted;

    beforeAll(async () => {
        daemon = await startDaemon({ policy: { presence: true } });
        restricted = await daemon.connect({ access: 'restricted' });
    });

    afterAll(async () => {
        restricted?.close();
        await daemon?.stop();
    });

    it('lets restricted access set it', async () => {
        expect(await restricted.request('presence.set', { show: 'xa', message: 'Out for a while' })).toEqual({
            show: 'xa',
            status_message: 'Out for a while',
        });
    });
});
