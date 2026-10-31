import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eventually, registerAccount, startDaemon, startProxy } from './real-server.js';

/**
 * The text of each WebSocket frame one connection's client sent, unmasked.
 * Clients mask their frames, so the bytes on the wire don't show the text, and
 * what a server reads is what has to be checked.
 * @param {Buffer} wire - Everything that connection's client sent, starting with its HTTP upgrade
 * @returns {string[]}
 */
function clientFrames(wire) {
    const frames = [];
    let at = wire.indexOf('\r\n\r\n') + 4;
    while (at < wire.length) {
        if (at + 2 > wire.length) break;
        const masked = (wire[at + 1] & 0x80) !== 0;
        let length = wire[at + 1] & 0x7f;
        at += 2;
        if (length === 126) {
            length = wire.readUInt16BE(at);
            at += 2;
        } else if (length === 127) {
            length = Number(wire.readBigUInt64BE(at));
            at += 8;
        }
        const key = masked ? wire.subarray(at, at + 4) : null;
        if (masked) at += 4;
        const payload = Buffer.from(wire.subarray(at, at + length));
        if (key) for (let i = 0; i < payload.length; i++) payload[i] ^= key[i % 4];
        frames.push(payload.toString('utf8'));
        at += length;
    }
    return frames;
}

describe('OMEMO on a real Prosody', () => {
    const daemons = [];
    let proxy, romeo, juliet;

    beforeAll(async () => {
        proxy = await startProxy();
        const [romeo_account, juliet_account] = await Promise.all([
            registerAccount('omemo-romeo'),
            registerAccount('omemo-juliet'),
        ]);
        // Their device lists and bundles are published with open access, so neither needs a subscription to the other.
        [romeo, juliet] = await Promise.all([
            startDaemon(romeo_account, { websocket_url: proxy.websocket_url, settings: { omemo_default: true } }),
            startDaemon(juliet_account, { websocket_url: proxy.websocket_url, settings: { omemo_default: true } }),
        ]);
        daemons.push(romeo, juliet);
    });

    afterAll(async () => {
        await Promise.all(daemons.map((daemon) => daemon.stop()));
        proxy?.close();
    });

    it('exchanges encrypted messages both ways, and the server only ever sees ciphertext', async () => {
        const secret = `Whatever Juliet hears, the server must not: ${Math.random().toString(36).slice(2)}`;
        const reply = `Nor may it read this reply ${Math.random().toString(36).slice(2)}`;

        // Each daemon has its own device on the server, and has found the other's.
        const devicesOf = (daemon, jid) =>
            daemon.requestFull('omemo.devices.list', { conversation: jid }).then(({ devices }) => devices);
        await eventually(async () => (await devicesOf(romeo, juliet.jid)).length > 0, {
            what: "Juliet's OMEMO devices to reach Romeo",
        });
        await eventually(async () => (await devicesOf(juliet, romeo.jid)).length > 0, {
            what: "Romeo's OMEMO devices to reach Juliet",
        });

        const sent = await romeo.requestFull('messages.send', { to: juliet.jid, body: secret });
        expect(sent).toMatchObject({ outcome: 'sent', message: { body: secret, encryption: { status: 'decrypted' } } });

        const received = await eventually(
            async () =>
                (await juliet.requestFull('messages.list', { conversation: romeo.jid })).messages.find(
                    (m) => m.body === secret,
                ),
            { what: 'the encrypted message to be decrypted for Juliet' },
        );
        expect(received).toMatchObject({ from: romeo.jid, direction: 'incoming', encryption: { status: 'decrypted' } });

        const answered = await juliet.requestFull('messages.send', { to: romeo.jid, body: reply });
        expect(answered).toMatchObject({ outcome: 'sent', message: { encryption: { status: 'decrypted' } } });
        await eventually(
            async () =>
                (await romeo.requestFull('messages.list', { conversation: juliet.jid })).messages.find(
                    (m) => m.body === reply,
                ),
            { what: 'the encrypted reply to be decrypted for Romeo' },
        );

        // The proof that it's checking something: the server did receive encrypted messages.
        const frames = proxy.sent().flatMap(clientFrames);
        expect(frames.filter((frame) => frame.includes('<encrypted')).length).toBeGreaterThan(0);
        expect(frames.some((frame) => frame.includes(secret) || frame.includes(reply))).toBe(false);
    });
});
