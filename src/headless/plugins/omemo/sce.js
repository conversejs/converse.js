/**
 * SCE (Stanza Content Encryption, XEP-0420) payload encryption for OMEMO 2.
 *
 * Implements the crypto layer required by XEP-0384 when using urn:xmpp:omemo:2:
 *   - AES-256-CBC + HMAC-SHA-256 authenticated encryption
 *   - HKDF-SHA-256 key derivation (80 bytes → encKey || authKey || IV)
 *   - The 48-byte tuple (key ‖ truncated-HMAC) is what each per-device
 *     SessionCipher.encrypt() receives
 *   - The SCE envelope wraps the plaintext XML in <envelope xmlns='urn:xmpp:sce:1'>
 */
import converse from '../../shared/api/public.js';

const { Strophe, u, stx, sizzle } = converse.env;

const HKDF_INFO = 'OMEMO Payload';

/**
 * Constant-time comparison of two byte arrays. Unlike a short-circuiting
 * compare (e.g. `Array.every`), the running time does not depend on where the
 * first differing byte is, so it leaks no information about the expected value
 * to a timing attacker. Used to verify the SCE HMAC tag.
 *
 * We hand-roll this rather than use `crypto.subtle.verify('HMAC', …)` (which
 * compares internally) because SCE truncates the HMAC to 16 bytes, and
 * `subtle.verify` only checks the full 32-byte SHA-256 output — there's no
 * supported way to verify a truncation. Node's `crypto.timingSafeEqual` isn't
 * an option either: it's absent in the browser, our production target.
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 * @returns {boolean}
 */
function constantTimeEqual(a, b) {
    // Fold the length difference into the accumulator so unequal-length inputs
    // can never compare equal, without an early return.
    let diff = a.length ^ b.length;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
        diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
    }
    return diff === 0;
}

/**
 * Derive encKey, authKey, IV from a random 32-byte content key using HKDF-SHA-256.
 * @param {ArrayBuffer} content_key - 32 random bytes
 * @returns {Promise<{encKey: ArrayBuffer, authKey: ArrayBuffer, iv: ArrayBuffer}>}
 */
async function deriveKeys(content_key) {
    const salt = new ArrayBuffer(32); // 32 zero bytes
    const ikm = await crypto.subtle.importKey('raw', content_key, 'HKDF', false, ['deriveBits']);
    const derived = await crypto.subtle.deriveBits(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt,
            info: new TextEncoder().encode(HKDF_INFO),
        },
        ikm,
        640, // 80 bytes = 640 bits
    );
    return {
        encKey: derived.slice(0, 32),
        authKey: derived.slice(32, 64),
        iv: derived.slice(64, 80),
    };
}

/**
 * Build the SCE <envelope> XML string for a given message body.
 *
 * Affixes per XEP-0384 SCE profile:
 *   - <rpad> MUST
 *   - <from> SHOULD (included)
 *   - <to> MUST for MUC (included when muc_jid is provided)
 *   - <time> MAY (omitted for now)
 *
 * @param {string} body - plaintext message body
 * @param {{from_jid: string, to_jid: string|null}} affixes
 * @returns {import('strophe.js').Builder}
 */
function buildSCEEnvelope(body, { from_jid, to_jid }) {
    const rpad_len = 1 + Math.floor(Math.random() * 100);
    const rpad = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(rpad_len))));

    return stx`
        <envelope xmlns="${Strophe.NS.SCE}">
            <content><body xmlns="jabber:client">${body}</body></content>
            <rpad>${rpad}</rpad>
            <from xmlns="${Strophe.NS.SCE}" jid="${from_jid}"/>
            ${to_jid ? stx`<to xmlns="${Strophe.NS.SCE}" jid="${to_jid}"/>` : ''}
        </envelope>`;
}

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
export async function encryptSCE(plaintext, affixes) {
    // Random 32-byte content key
    const content_key = crypto.getRandomValues(new Uint8Array(32)).buffer;
    const { encKey, authKey, iv } = await deriveKeys(content_key);

    const envelope = buildSCEEnvelope(plaintext, affixes);
    const plaintext_bytes = new TextEncoder().encode(envelope.toString());

    // AES-256-CBC encryption
    const aes_key = await crypto.subtle.importKey('raw', encKey, 'AES-CBC', false, ['encrypt']);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, aes_key, plaintext_bytes);

    // HMAC-SHA-256 over ciphertext, truncated to 16 bytes
    const hmac_key = await crypto.subtle.importKey('raw', authKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const hmac_full = await crypto.subtle.sign('HMAC', hmac_key, ciphertext);
    const hmac_16 = hmac_full.slice(0, 16);

    // 48-byte tuple: content_key(32) ‖ HMAC(16)
    const key_and_tag = new Uint8Array(48);
    key_and_tag.set(new Uint8Array(content_key), 0);
    key_and_tag.set(new Uint8Array(hmac_16), 32);

    return {
        key_and_tag: key_and_tag.buffer,
        payload: u.arrayBufferToBase64(ciphertext),
    };
}

/**
 * Decrypt an SCE/OMEMO 2 payload.
 *
 * @param {ArrayBuffer} key_and_tag - 48-byte tuple: content_key(32) ‖ HMAC(16)
 * @param {string} payload_b64 - base64-encoded AES-256-CBC ciphertext
 * @param {{sender_jid: string, to_jid?: string|null}} expected_affixes - for validation
 * @returns {Promise<string|null>} - plaintext message body
 */
export async function decryptSCE(key_and_tag, payload_b64, expected_affixes) {
    if (key_and_tag.byteLength !== 48) {
        throw new Error(`SCE key_and_tag must be 48 bytes, got ${key_and_tag.byteLength}`);
    }

    const content_key = key_and_tag.slice(0, 32);
    const expected_hmac = key_and_tag.slice(32, 48);
    const { encKey, authKey, iv } = await deriveKeys(content_key);

    const ciphertext = u.base64ToArrayBuffer(payload_b64);

    // Verify HMAC before decrypting
    const hmac_key = await crypto.subtle.importKey('raw', authKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const hmac_full = await crypto.subtle.sign('HMAC', hmac_key, ciphertext);
    const hmac_16 = new Uint8Array(hmac_full.slice(0, 16));
    const expected = new Uint8Array(expected_hmac);
    if (!constantTimeEqual(hmac_16, expected)) {
        throw new Error('SCE HMAC verification failed');
    }

    // AES-256-CBC decrypt
    const aes_key = await crypto.subtle.importKey('raw', encKey, 'AES-CBC', false, ['decrypt']);
    const plaintext_bytes = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, aes_key, ciphertext);
    const envelope_xml = new TextDecoder().decode(plaintext_bytes);

    return parseSCEEnvelope(envelope_xml, expected_affixes);
}

/**
 * Parse an SCE <envelope> and validate affixes, returning the message body.
 * @param {string} envelope_xml
 * @param {{sender_jid: string, to_jid?: string|null}} expected_affixes
 * @returns {string}
 */
function parseSCEEnvelope(envelope_xml, { sender_jid, to_jid }) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(envelope_xml, 'application/xml');

    const envelope = doc.documentElement;
    if (!envelope || envelope.localName !== 'envelope' || envelope.namespaceURI !== Strophe.NS.SCE) {
        throw new Error('SCE: no <envelope> found in decrypted payload');
    }

    // Validate <from> affix (SHOULD be present, MUST match sender if present)
    const from_el = sizzle(`> from[xmlns="${Strophe.NS.SCE}"]`, envelope).pop();
    if (from_el) {
        const from_jid = from_el.getAttribute('jid');
        if (sender_jid && !u.isSameBareJID(from_jid, sender_jid)) {
            throw new Error(`SCE affix mismatch: <from> is ${from_jid}, expected ${sender_jid}`);
        }
    }

    // Validate <to> affix (MUST be present and correct for MUC)
    if (to_jid) {
        const to_el = sizzle(`> to[xmlns="${Strophe.NS.SCE}"]`, envelope).pop();
        if (!to_el) {
            throw new Error('SCE: missing required <to> affix for MUC message');
        }
        if (!u.isSameBareJID(to_el.getAttribute('jid'), to_jid)) {
            throw new Error(`SCE affix mismatch: <to> is ${to_el.getAttribute('jid')}, expected ${to_jid}`);
        }
    }

    const content_el = sizzle('> content', envelope).pop();
    const body_el = content_el ? sizzle('> body', content_el).pop() : null;
    if (!body_el) {
        // Empty/heartbeat message — no body
        return null;
    }
    return body_el.textContent;
}
