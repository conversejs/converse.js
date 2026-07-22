/**
 * Exercises the real libomemo.js WebAssembly under Node.
 *
 * The loader in `shims/node-omemo.js` leans on some unobvious Emscripten
 * behaviour to get the wasm read at all (see that module). These tests do
 * genuine curve25519 work, so if a libomemo rebuild changes any of it, this
 * fails rather than OMEMO quietly breaking at runtime.
 */
import { describe, expect, it } from 'vitest';
import '../node-omemo.js';
import { getCrypto } from '../../plugins/omemo/crypto.js';

describe('libomemo.js under Node', () => {
    it('loads the library', async () => {
        const crypto = await getCrypto();
        expect(typeof crypto.KeyHelper).toBe('object');
    });

    it('returns the same promise on repeated calls', async () => {
        expect(getCrypto()).toBe(getCrypto());
    });

    it('generates an identity key pair with the wasm curve25519', async () => {
        const { KeyHelper } = await getCrypto();
        const pair = await KeyHelper.generateIdentityKeyPair();
        // 32 key bytes plus the 0x05 DJB type byte.
        expect(pair.pubKey.byteLength).toBe(33);
        expect(pair.privKey.byteLength).toBe(32);
    });

    it('signs a prekey for both OMEMO versions', async () => {
        const { KeyHelper } = await getCrypto();
        const identity = await KeyHelper.generateIdentityKeyPair();

        for (const version of ['eu.siacs.conversations.axolotl', 'urn:xmpp:omemo:2']) {
            const signed = await KeyHelper.generateSignedPreKey(identity, 0, version);
            expect(signed.signature.byteLength).toBe(64);
            expect(signed.keyPair.pubKey.byteLength).toBe(33);
        }
    });

    it('generates prekeys and registration ids', async () => {
        const { KeyHelper } = await getCrypto();
        const prekey = await KeyHelper.generatePreKey(7);
        expect(prekey.keyId).toBe(7);
        expect(prekey.keyPair.pubKey.byteLength).toBe(33);
        expect(typeof KeyHelper.generateRegistrationId()).toBe('number');
    });

    it('converts between curve and ed25519 public keys', async () => {
        const { KeyHelper, curvePubKeyToEd25519PubKey, ed25519PubKeyToCurvePubKey } = await getCrypto();
        const pair = await KeyHelper.generateIdentityKeyPair();

        const ed = await curvePubKeyToEd25519PubKey(pair.pubKey);
        const round_tripped = await ed25519PubKeyToCurvePubKey(ed);
        // The conversion works on the raw key, so it comes back without the
        // leading 0x05 DJB type byte that `pubKey` carries.
        expect(new Uint8Array(round_tripped)).toEqual(new Uint8Array(pair.pubKey).slice(1));
    });
});
