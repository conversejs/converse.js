/**
 * Encrypt a message body using the SCE/OMEMO 2 scheme.
 *
 * Returns the 48-byte key_and_tag (content_key ‖ truncated-HMAC) as an
 * ArrayBuffer — this is what gets encrypted with SessionCipher per device —
 * and the base64-encoded AES-256-CBC ciphertext as the <payload> value.
 *
 * @param {string} plaintext - the message body to encrypt
 * @param {{from_jid: string, to_jid: string|null}} affixes
 * @param {import('strophe.js').Builder[]} [extensions] - body-coupled metadata elements
 * @returns {Promise<{key_and_tag: ArrayBuffer, payload: string}>}
 */
export function encryptSCE(plaintext: string, affixes: {
    from_jid: string;
    to_jid: string | null;
}, extensions?: import('strophe.js').Builder[]): Promise<{
    key_and_tag: ArrayBuffer;
    payload: string;
}>;
/**
 * Decrypt an SCE/OMEMO 2 payload.
 *
 * Returns both the plaintext body string and the decrypted `<content>` element,
 * so callers can re-run the normal stanza parsers (references/reply/oob/spoiler)
 * against the authenticated content. `body`/`content` are `null` for a
 * heartbeat (payload-less / bodyless) message.
 *
 * @param {ArrayBuffer} key_and_tag - 48-byte tuple: content_key(32) ‖ HMAC(16)
 * @param {string} payload_b64 - base64-encoded AES-256-CBC ciphertext
 * @param {{sender_jid: string, to_jid?: string|null}} expected_affixes - for validation
 * @returns {Promise<{body: string|null, content: Element|null}>}
 */
export function decryptSCE(key_and_tag: ArrayBuffer, payload_b64: string, expected_affixes: {
    sender_jid: string;
    to_jid?: string | null;
}): Promise<{
    body: string | null;
    content: Element | null;
}>;
//# sourceMappingURL=sce.d.ts.map