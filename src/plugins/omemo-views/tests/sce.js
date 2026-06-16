import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

describe('OMEMO 2 SCE encryption', function () {
    it(
        'can encrypt and decrypt a message body (round-trip)',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const plaintext = 'But soft, what light through yonder airlock breaks?';
            const affixes = { from_jid: 'romeo@montague.lit', to_jid: null };

            const { key_and_tag, payload } = await u.omemo.encryptSCE(plaintext, affixes);

            // key_and_tag is the 48-byte tuple (32-byte content key + 16-byte HMAC)
            expect(key_and_tag.byteLength).toBe(48);
            expect(typeof payload).toBe('string');
            // The ciphertext must not contain the plaintext
            expect(atob(payload).includes(plaintext)).toBe(false);

            const decrypted = await u.omemo.decryptSCE(key_and_tag, payload, {
                sender_jid: 'romeo@montague.lit',
            });
            expect(decrypted.body).toBe(plaintext);
        }),
    );

    it(
        'round-trips message bodies containing XML special characters',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const plaintext = 'a < b && c > d "quoted" \'single\' <tag/>';
            const affixes = { from_jid: 'romeo@montague.lit', to_jid: null };

            const { key_and_tag, payload } = await u.omemo.encryptSCE(plaintext, affixes);
            const decrypted = await u.omemo.decryptSCE(key_and_tag, payload, {
                sender_jid: 'romeo@montague.lit',
            });
            expect(decrypted.body).toBe(plaintext);
        }),
    );

    it(
        'encrypts body-coupled metadata extensions inside <content> and exposes them on decryption',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const { stx } = converse.env;
            const { Strophe } = converse.env;
            const plaintext = 'Hello @juliet, see the airlock';
            const affixes = { from_jid: 'romeo@montague.lit', to_jid: null };
            const extensions = [
                stx`<reference xmlns="${Strophe.NS.REFERENCE}" begin="6" end="13" type="mention" uri="xmpp:juliet@capulet.lit"></reference>`,
                stx`<reply xmlns="${Strophe.NS.REPLY}" id="some-msg-id" to="juliet@capulet.lit"></reply>`,
            ];

            const { key_and_tag, payload } = await u.omemo.encryptSCE(plaintext, affixes, extensions);

            // The metadata must not leak in cleartext (the payload is ciphertext)
            expect(atob(payload).includes('juliet@capulet.lit')).toBe(false);

            const { body, content } = await u.omemo.decryptSCE(key_and_tag, payload, {
                sender_jid: 'romeo@montague.lit',
            });
            expect(body).toBe(plaintext);
            expect(content.querySelector('reference').getAttribute('uri')).toBe('xmpp:juliet@capulet.lit');
            expect(content.querySelector('reply').getAttribute('id')).toBe('some-msg-id');
        }),
    );

    it(
        'round-trips a metadata-only (bodyless) message such as a reaction',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const { stx } = converse.env;
            const affixes = { from_jid: 'romeo@montague.lit', to_jid: null };
            const extensions = [
                stx`<reactions xmlns="urn:xmpp:reactions:0" id="target-msg-id"><reaction>👍</reaction></reactions>`,
            ];

            // No body — this is a metadata-only stanza.
            const { key_and_tag, payload } = await u.omemo.encryptSCE(null, affixes, extensions);

            const { body, content } = await u.omemo.decryptSCE(key_and_tag, payload, {
                sender_jid: 'romeo@montague.lit',
            });
            // A bodyless content must NOT be mistaken for a heartbeat: content is
            // surfaced, body is null.
            expect(body).toBe(null);
            expect(content).toBeTruthy();
            expect(content.querySelector('body')).toBe(null);
            const reactions = content.getElementsByTagNameNS('urn:xmpp:reactions:0', 'reactions')[0];
            expect(reactions.getAttribute('id')).toBe('target-msg-id');
            expect(reactions.querySelector('reaction').textContent).toBe('👍');
        }),
    );

    it(
        'includes a <to> affix for MUC messages and validates it on decryption',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const plaintext = 'This is a groupchat message';
            const muc_jid = 'lounge@montague.lit';
            const affixes = { from_jid: 'romeo@montague.lit', to_jid: muc_jid };

            const { key_and_tag, payload } = await u.omemo.encryptSCE(plaintext, affixes);

            // Correct to_jid validates
            const decrypted = await u.omemo.decryptSCE(key_and_tag, payload, {
                sender_jid: 'romeo@montague.lit',
                to_jid: muc_jid,
            });
            expect(decrypted.body).toBe(plaintext);

            // Wrong to_jid is rejected
            let error;
            try {
                await u.omemo.decryptSCE(key_and_tag, payload, {
                    sender_jid: 'romeo@montague.lit',
                    to_jid: 'wrong@montague.lit',
                });
            } catch (e) {
                error = e;
            }
            expect(error).toBeDefined();
            expect(error.message).toContain('affix mismatch');
        }),
    );

    it(
        'rejects a message whose <from> affix does not match the sender',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const plaintext = 'Spoofed message';
            const affixes = { from_jid: 'mercutio@montague.lit', to_jid: null };

            const { key_and_tag, payload } = await u.omemo.encryptSCE(plaintext, affixes);

            let error;
            try {
                await u.omemo.decryptSCE(key_and_tag, payload, {
                    sender_jid: 'romeo@montague.lit',
                });
            } catch (e) {
                error = e;
            }
            expect(error).toBeDefined();
            expect(error.message).toContain('affix mismatch');
        }),
    );

    it(
        'rejects a payload whose HMAC does not verify',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const plaintext = 'Tamper-evident message';
            const affixes = { from_jid: 'romeo@montague.lit', to_jid: null };

            const { key_and_tag, payload } = await u.omemo.encryptSCE(plaintext, affixes);

            // Flip the last byte of the HMAC portion of key_and_tag
            const tampered = key_and_tag.slice(0);
            const view = new Uint8Array(tampered);
            view[47] = view[47] ^ 0xff;

            let error;
            try {
                await u.omemo.decryptSCE(tampered, payload, { sender_jid: 'romeo@montague.lit' });
            } catch (e) {
                error = e;
            }
            expect(error).toBeDefined();
            expect(error.message).toContain('HMAC verification failed');
        }),
    );

    it(
        'rejects a key_and_tag that is not 48 bytes',
        mock.initConverse(converse, [], {}, async function (_converse) {
            let error;
            try {
                await u.omemo.decryptSCE(new ArrayBuffer(32), 'AAAA', { sender_jid: 'romeo@montague.lit' });
            } catch (e) {
                error = e;
            }
            expect(error).toBeDefined();
            expect(error.message).toContain('must be 48 bytes');
        }),
    );
});
