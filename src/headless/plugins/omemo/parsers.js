/**
 * @typedef {import('../../shared/types').MessageAttributes} MessageAttributes
 * @typedef {import('../../plugins/muc/types').MUCMessageAttributes} MUCMessageAttributes
 * @typedef {import('./types').MUCMessageAttrsWithEncryption} MUCMessageAttrsWithEncryption
 * @typedef {import('./types').MessageAttrsWithEncryption} MessageAttrsWithEncryption
 */
import sizzle from 'sizzle';
import log from '@converse/log';
import api from '../../shared/api/index.js';
import _converse from '../../shared/_converse.js';
import converse from '../../shared/api/public.js';
import u from '../../utils/index.js';
import { decryptMessage, getSessionCipher } from './utils.js';
import { decryptSCE } from './sce.js';

const { Strophe } = converse.env;

const DECRYPTION_ERROR_ATTRS = {
    error_type: 'Decryption',
    is_ephemeral: true,
    // Don't start the ephemeral auto-destruct countdown until the message has
    // actually been seen by the user (handled in the view).
    defer_ephemeral_timer: true,
    is_error: true,
    type: 'error',
};

/**
 * @returns {object}
 */
function getNoKeyErrorAttrs() {
    const { __ } = _converse;
    return {
        ...DECRYPTION_ERROR_ATTRS,
        error_condition: 'not-encrypted-for-this-device',
        error_text: __(
            'Received an OMEMO encrypted message which could not be decrypted, ' +
                'because it was not encrypted for this device.',
        ),
    };
}

/**
 * Whether a decryption failure is caused by the message being a duplicate that
 * we already decrypted once (libsignal raises a `MessageCounterError` when the
 * ratchet's message key has already been used). Per XEP-0384 §Business Rules,
 * clients MUST silently ignore these and not show any warning/error.
 * @param {Error} e
 * @returns {boolean}
 */
function isDuplicateDecryptionError(e) {
    return e?.name === 'MessageCounterError';
}

/**
 * @param {Error} e
 */
function getDecryptionErrorAttributes(e) {
    const { __ } = _converse;
    return {
        ...DECRYPTION_ERROR_ATTRS,
        error_text:
            __('Sorry, could not decrypt a received OMEMO message due to an error.') + ` ${e.name} ${e.message}`,
        error_condition: e.name,
        error_message: e.message,
    };
}

/**
 * We use the bare, real (i.e. non-MUC) JID as encrypted session identifier.
 * @param {MUCMessageAttributes|MessageAttributes} attrs
 */
function getJIDForDecryption(attrs) {
    const { __ } = _converse;
    let from_jid;
    if (attrs.sender === 'me') {
        from_jid = _converse.session.get('bare_jid');
    } else if (attrs.contact_jid) {
        from_jid = attrs.contact_jid;
    } else if ('from_real_jid' in attrs) {
        from_jid = attrs.from_real_jid;
    } else {
        from_jid = attrs.from;
    }

    if (!from_jid) {
        Object.assign(attrs, {
            error_text: __(
                'Sorry, could not decrypt a received OMEMO ' +
                    "message because we don't have the XMPP address for that user.",
            ),
            error_type: 'Decryption',
            is_ephemeral: true,
            is_error: true,
            type: 'error',
        });
        throw new Error('Could not find JID to decrypt OMEMO message for');
    }
    return from_jid;
}

/**
 * @param {MUCMessageAttributes|MessageAttributes} attrs
 * @param {ArrayBuffer} key_and_tag
 */
async function handleDecryptedWhisperMessage(attrs, key_and_tag) {
    const from_jid = getJIDForDecryption(attrs);
    const devicelist = await api.omemo.devicelists.get(from_jid, true);
    const encrypted = attrs.encrypted;
    let device = devicelist.devices.get(encrypted.device_id);
    if (!device) {
        device = await devicelist.devices.create({ 'id': encrypted.device_id, 'jid': from_jid }, { 'promise': true });
    }
    if (encrypted.payload) {
        const key = key_and_tag.slice(0, 16);
        const tag = key_and_tag.slice(16);
        const result = await decryptMessage({
            ...encrypted,
            payload: encrypted.payload,
            ...{ key, tag },
        });
        device.save('active', true);
        return result;
    }
}

/**
 * @param {MUCMessageAttributes|MessageAttributes} attrs
 */
async function decryptWhisperMessage(attrs) {
    const from_jid = getJIDForDecryption(attrs);
    const session_cipher = await getSessionCipher(from_jid, parseInt(attrs.encrypted.device_id, 10));
    const key = u.base64ToArrayBuffer(attrs.encrypted.key);
    try {
        const key_and_tag = await session_cipher.decryptWhisperMessage(key, 'binary');
        const plaintext = await handleDecryptedWhisperMessage(attrs, key_and_tag);
        return Object.assign(attrs, { plaintext });
    } catch (e) {
        if (isDuplicateDecryptionError(e)) {
            // XEP-0384: a message we already decrypted. Ignore it silently.
            log.debug(`Ignoring a duplicate OMEMO message: ${e.message}`);
            return attrs;
        }
        log.error(`${e.name} ${e.message}`);
        return Object.assign(attrs, getDecryptionErrorAttributes(e));
    }
}

/**
 * @param {MUCMessageAttributes|MessageAttributes} attrs
 */
async function decryptPrekeyWhisperMessage(attrs) {
    const from_jid = getJIDForDecryption(attrs);
    const session_cipher = await getSessionCipher(from_jid, parseInt(attrs.encrypted.device_id, 10));
    const key = u.base64ToArrayBuffer(attrs.encrypted.key);
    let key_and_tag;
    try {
        key_and_tag = await session_cipher.decryptPreKeyWhisperMessage(key, 'binary');
    } catch (e) {
        if (isDuplicateDecryptionError(e)) {
            // XEP-0384: a message we already decrypted. Ignore it silently.
            log.debug(`Ignoring a duplicate OMEMO message: ${e.message}`);
            return attrs;
        }
        // TODO from the XEP: In all cases of decryption failure (other than a
        // duplicate, handled above), clients SHOULD respond by forcibly doing a
        // new key exchange and sending a new OMEMOKeyExchange with a potentially
        // empty SCE payload. By building a new session with the original sender
        // this way, the invalid session of the original sender will get
        // overwritten with this newly created, valid session.
        log.error(`${e.name} ${e.message}`);
        return Object.assign(attrs, getDecryptionErrorAttributes(e));
    }
    // TODO from the XEP:
    // When a client receives the first message for a given
    // ratchet key with a counter of 53 or higher, it MUST send
    // a heartbeat message. Heartbeat messages are normal OMEMO
    // encrypted messages where the SCE payload does not include
    // any elements. These heartbeat messages cause the ratchet
    // to forward, thus consequent messages will have the
    // counter restarted from 0.
    try {
        const plaintext = await handleDecryptedWhisperMessage(attrs, key_and_tag);
        const { omemo_store } = _converse.state;
        await omemo_store.generateMissingPreKeys();
        await omemo_store.publishBundle();
        if (plaintext) {
            return Object.assign(attrs, { 'plaintext': plaintext });
        } else {
            return Object.assign(attrs, { 'is_only_key': true });
        }
    } catch (e) {
        log.error(`${e.name} ${e.message}`);
        return Object.assign(attrs, getDecryptionErrorAttributes(e));
    }
}

/**
 * Decrypt a legacy OMEMO (eu.siacs.conversations.axolotl) message.
 * @param {Element} stanza
 * @param {MUCMessageAttributes|MessageAttributes} attrs
 * @returns {Promise<MUCMessageAttributes|MessageAttributes|MUCMessageAttrsWithEncryption|MessageAttrsWithEncryption>}
 */
async function decryptLegacyOMEMOMessage(stanza, attrs) {
    const encrypted_el = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO}"]`, stanza).pop();
    const header = encrypted_el.querySelector('header');
    attrs.encrypted = { 'device_id': header.getAttribute('sid') };

    const device_id = await api.omemo?.getDeviceID();
    const key = device_id && sizzle(`key[rid="${device_id}"]`, encrypted_el).pop();
    if (key) {
        Object.assign(attrs.encrypted, {
            iv: header.querySelector('iv').textContent,
            key: key.textContent,
            payload: encrypted_el.querySelector('payload')?.textContent || null,
            prekey: ['true', '1'].includes(key.getAttribute('prekey')),
        });
    } else {
        return Object.assign(attrs, getNoKeyErrorAttrs());
    }
    // https://xmpp.org/extensions/xep-0384.html#usecases-receiving
    if (attrs.encrypted.prekey === true) {
        return decryptPrekeyWhisperMessage(attrs);
    } else {
        return decryptWhisperMessage(attrs);
    }
}

/**
 * Decrypt an OMEMO 2 message.
 * @param {Element} stanza
 * @param {MUCMessageAttributes|MessageAttributes} attrs
 * @returns {Promise<MUCMessageAttributes|MessageAttributes|MUCMessageAttrsWithEncryption|MessageAttrsWithEncryption>}
 */
async function decryptOMEMO2Message(stanza, attrs) {
    const encrypted_el = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO2}"]`, stanza).pop();
    if (!encrypted_el) return attrs;

    const header = encrypted_el.querySelector('header');
    const sender_device_id = header.getAttribute('sid');

    const device_id = await api.omemo?.getDeviceID();
    if (!device_id) return attrs;

    // Find our <key rid='...'> under any <keys jid='our_bare_jid'>
    const bare_jid = _converse.session.get('bare_jid');
    const keys_el = sizzle(`keys[jid="${bare_jid}"]`, encrypted_el).pop();
    if (!keys_el) {
        return Object.assign(attrs, getNoKeyErrorAttrs());
    }

    const key_el = keys_el.querySelector(`key[rid="${device_id}"]`);
    if (!key_el) {
        return Object.assign(attrs, getNoKeyErrorAttrs());
    }

    const from_jid = getJIDForDecryption(attrs);
    const key_b64 = key_el.textContent.trim();
    const key_bytes = u.base64ToArrayBuffer(key_b64);

    // Whether the <key> holds a key exchange (OMEMOKeyExchange) or a regular
    // message (OMEMOAuthenticatedMessage). We detect this from the payload
    // rather than trusting the `kex` attribute: libsignal-based senders (e.g.
    // QXmpp/Kaidan) keep emitting key-exchange messages until they receive a
    // reply, but only set kex="true" on the first one, leaving the repeats
    // mislabelled. The two protobufs are unambiguous by their first tag byte —
    // OMEMOKeyExchange begins with field 1 `pk_id` (varint → 0x08), whereas
    // OMEMOAuthenticatedMessage begins with field 1 `mac` (bytes → 0x0A).
    const is_kex = new Uint8Array(key_bytes)[0] === 0x08 || key_el.getAttribute('kex') === 'true';

    attrs.encrypted = {
        device_id: sender_device_id,
        key: key_b64,
        payload: encrypted_el.querySelector('payload')?.textContent?.trim() || null,
        prekey: is_kex,
    };

    const session_cipher = await getSessionCipher(from_jid, parseInt(sender_device_id, 10), Strophe.NS.OMEMO2);

    let key_and_tag;
    try {
        if (is_kex) {
            key_and_tag = await session_cipher.decryptPreKeyWhisperMessage(key_bytes, 'binary');
            // After handling a key exchange, regenerate and publish prekeys
            const { omemo_store } = _converse.state;
            await omemo_store.generateMissingPreKeys();
            await omemo_store.publishBundle();
        } else {
            key_and_tag = await session_cipher.decryptWhisperMessage(key_bytes, 'binary');
        }
    } catch (e) {
        if (isDuplicateDecryptionError(e)) {
            // XEP-0384: a message we already decrypted. Ignore it silently.
            log.debug(`Ignoring a duplicate OMEMO 2 message: ${e.message}`);
            return attrs;
        }
        log.error(`OMEMO 2 decryption failed: ${e.name} ${e.message}`);
        return Object.assign(attrs, getDecryptionErrorAttributes(e));
    }

    if (!attrs.encrypted.payload) {
        // Empty/heartbeat message
        return Object.assign(attrs, { 'is_only_key': true });
    }

    try {
        const is_muc = 'from_real_jid' in attrs;
        const muc_jid = is_muc ? attrs.from : null;
        const plaintext = await decryptSCE(key_and_tag, attrs.encrypted.payload, {
            sender_jid: from_jid,
            to_jid: muc_jid,
        });

        // Update device active state
        const devicelist = await api.omemo.devicelists.get(from_jid, true, Strophe.NS.OMEMO2);
        let device = devicelist.devices.get(sender_device_id);
        if (!device) {
            device = await devicelist.devices.create({ 'id': sender_device_id, 'jid': from_jid }, { 'promise': true });
        }
        device.save('active', true);

        if (plaintext) {
            return Object.assign(attrs, { plaintext });
        } else {
            return Object.assign(attrs, { 'is_only_key': true });
        }
    } catch (e) {
        log.error(`SCE decryption failed: ${e.name} ${e.message}`);
        return Object.assign(attrs, getDecryptionErrorAttributes(e));
    }
}

/**
 * Hook handler for {@link parseMessage} and {@link parseMUCMessage}, which
 * parses the passed in `message` stanza for OMEMO attributes and then sets
 * them on the attrs object.
 *
 * A single stanza may carry both an `urn:xmpp:omemo:2` and a legacy
 * `eu.siacs.conversations.axolotl` `<encrypted>` element: a sender that
 * supports both addresses each recipient device in whichever version that
 * device understands. The EME (XEP-0380) hint names only one method and exists
 * for clients that can decrypt *neither* — it must not be used to pick a
 * decryption path. So we route on which `<encrypted>` block actually contains a
 * `<key>` for our own device, preferring omemo:2.
 *
 * @param {Element} stanza - The message stanza
 * @param {MUCMessageAttributes|MessageAttributes} attrs
 * @returns {Promise<MUCMessageAttributes| MessageAttributes|MUCMessageAttrsWithEncryption|MessageAttrsWithEncryption>}
 */
export async function parseEncryptedMessage(stanza, attrs) {
    if (api.settings.get('clear_cache_on_logout') || !attrs.is_encrypted) {
        return attrs;
    }

    const device_id = await api.omemo?.getDeviceID();
    const bare_jid = _converse.session.get('bare_jid');

    const v2_el = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO2}"]`, stanza).pop();
    const legacy_el = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO}"]`, stanza).pop();

    const has_v2_key =
        !!(v2_el && device_id) && sizzle(`keys[jid="${bare_jid}"] key[rid="${device_id}"]`, v2_el).length > 0;
    const has_legacy_key = !!(legacy_el && device_id) && sizzle(`key[rid="${device_id}"]`, legacy_el).length > 0;

    if (has_v2_key) {
        return await decryptOMEMO2Message(stanza, attrs);
    }
    if (has_legacy_key) {
        return await decryptLegacyOMEMOMessage(stanza, attrs);
    }

    // The message is OMEMO-encrypted but no <key> is addressed to this device.
    // Only surface the "not encrypted for this device" error once we actually
    // know our own device id, otherwise OMEMO isn't ready yet and we'd raise a
    // spurious error during an init race.
    if (device_id && (v2_el || legacy_el)) {
        return Object.assign(attrs, getNoKeyErrorAttrs());
    }

    // Not an OMEMO message we can handle; leave attrs untouched so any EME
    // fallback body is shown.
    return attrs;
}

/**
 * Given an XML element representing a legacy OMEMO bundle, parse it
 * and return a map.
 * @param {Element} bundle_el
 * @returns {import('./types').Bundle}
 */
export function parseBundle(bundle_el) {
    const signed_prekey_public_el = bundle_el.querySelector('signedPreKeyPublic');
    const signed_prekey_signature_el = bundle_el.querySelector('signedPreKeySignature');
    const prekeys = sizzle(`prekeys > preKeyPublic`, bundle_el).map(
        /** @param {Element} el */ (el) => ({
            id: parseInt(el.getAttribute('preKeyId'), 10),
            key: el.textContent,
        }),
    );
    return {
        identity_key: bundle_el.querySelector('identityKey').textContent.trim(),
        signed_prekey: {
            id: parseInt(signed_prekey_public_el.getAttribute('signedPreKeyId'), 10),
            public_key: signed_prekey_public_el.textContent,
            signature: signed_prekey_signature_el.textContent,
        },
        prekeys,
    };
}

/**
 * Given an XML element representing an OMEMO 2 bundle, parse it
 * and return a map using the same internal format as the legacy bundle.
 *
 * All key values are base64-encoded 32-byte raw Curve25519/Ed25519 bytes
 * (the leading 0x05 byte is absent for v2).
 *
 * @param {Element} bundle_el
 * @returns {import('./types').Bundle}
 */
export function parseBundleV2(bundle_el) {
    const spk_el = bundle_el.querySelector('spk');
    const prekeys = sizzle('prekeys > pk', bundle_el).map(
        /** @param {Element} el */ (el) => ({
            id: parseInt(el.getAttribute('id'), 10),
            key: el.textContent.trim(),
        }),
    );
    return {
        identity_key: bundle_el.querySelector('ik').textContent.trim(),
        signed_prekey: {
            id: parseInt(spk_el.getAttribute('id'), 10),
            public_key: spk_el.textContent.trim(),
            signature: bundle_el.querySelector('spks').textContent.trim(),
        },
        prekeys,
    };
}

Object.assign(u, {
    omemo: {
        ...u.omemo,
        parseBundle,
        parseBundleV2,
    },
});
