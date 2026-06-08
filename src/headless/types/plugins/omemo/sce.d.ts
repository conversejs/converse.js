/**
 * Encrypt a message body using the SCE/OMEMO 2 scheme.
 *
 * Returns the 48-byte key_and_tag (content_key ‖ truncated-HMAC) as an
 * ArrayBuffer — this is what gets encrypted with SessionCipher per device —
 * and the base64-encoded AES-256-CBC ciphertext as the <payload> value.
 *
 * @param {string} plaintext - the message body to encrypt
 * @param {{from_jid: string, to_jid: string|null}} affixes
 * @returns {Promise<{key_and_tag: ArrayBuffer, payload: string}>}
 */
export function encryptSCE(plaintext: string, affixes: {
    from_jid: string;
    to_jid: string | null;
}): Promise<{
    key_and_tag: ArrayBuffer;
    payload: string;
}>;
/**
 * Decrypt an SCE/OMEMO 2 payload.
 *
 * @param {ArrayBuffer} key_and_tag - 48-byte tuple: content_key(32) ‖ HMAC(16)
 * @param {string} payload_b64 - base64-encoded AES-256-CBC ciphertext
 * @param {{sender_jid: string, to_jid?: string|null}} expected_affixes - for validation
 * @returns {Promise<string|null>} - plaintext message body
 */
export function decryptSCE(key_and_tag: ArrayBuffer, payload_b64: string, expected_affixes: {
    sender_jid: string;
    to_jid?: string | null;
}): Promise<string | null>;
//# sourceMappingURL=sce.d.ts.map