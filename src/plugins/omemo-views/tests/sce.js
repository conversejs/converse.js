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
            expect(decrypted).toBe(plaintext);
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
            expect(decrypted).toBe(plaintext);
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
            expect(decrypted).toBe(plaintext);

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
