/**
 * @typedef {import('../..//shared/types').MessageAttributes} MessageAttributes
 * @typedef {import('../../plugins/muc/types').MUCMessageAttributes} MUCMessageAttributes
 */
import sizzle from 'sizzle';
import log from '@converse/log';
import api from '../../shared/api/index.js';
import _converse from '../../shared/_converse.js';
import converse from '../../shared/api/public.js';
import u from '../../utils/index.js';
import { decryptMessage, getSessionCipher } from './utils.js';

const { Strophe } = converse.env;

function getDecryptionErrorAttributes(e) {
    const { __ } = _converse;
    return {
        'error_text':
            __('Sorry, could not decrypt a received OMEMO message due to an error.') + ` ${e.name} ${e.message}`,
        'error_condition': e.name,
        'error_message': e.message,
        'error_type': 'Decryption',
        'is_ephemeral': true,
        'is_error': true,
        'type': 'error',
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
                    "message because we don't have the XMPP address for that user."
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
            ...{ key, tag }
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
    const session_cipher = getSessionCipher(from_jid, parseInt(attrs.encrypted.device_id, 10));
    const key = u.base64ToArrayBuffer(attrs.encrypted.key);
    try {
        const key_and_tag = await session_cipher.decryptWhisperMessage(key, 'binary');
        const plaintext = await handleDecryptedWhisperMessage(attrs, key_and_tag);
        return Object.assign(attrs, { plaintext });
    } catch (e) {
        log.error(`${e.name} ${e.message}`);
        return Object.assign(attrs, getDecryptionErrorAttributes(e));
    }
}

/**
 * @param {MUCMessageAttributes|MessageAttributes} attrs
 */
async function decryptPrekeyWhisperMessage(attrs) {
    const from_jid = getJIDForDecryption(attrs);
    const session_cipher = getSessionCipher(from_jid, parseInt(attrs.encrypted.device_id, 10));
    const key = u.base64ToArrayBuffer(attrs.encrypted.key);
    let key_and_tag;
    try {
        key_and_tag = await session_cipher.decryptPreKeyWhisperMessage(key, 'binary');
    } catch (e) {
        // TODO from the XEP:
        // There are various reasons why decryption of an
        // OMEMOKeyExchange or an OMEMOAuthenticatedMessage
        // could fail. One reason is if the message was
        // received twice and already decrypted once, in this
        // case the client MUST ignore the decryption failure
        // and not show any warnings/errors. In all other cases
        // of decryption failure, clients SHOULD respond by
        // forcibly doing a new key exchange and sending a new
        // OMEMOKeyExchange with a potentially empty SCE
        // payload. By building a new session with the original
        // sender this way, the invalid session of the original
        // sender will get overwritten with this newly created,
        // valid session.
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
 * Hook handler for {@link parseMessage} and {@link parseMUCMessage}, which
 * parses the passed in `message` stanza for OMEMO attributes and then sets
 * them on the attrs object.
 * @param {Element} stanza - The message stanza
 * @param {MUCMessageAttributes|MessageAttributes} attrs
 * @returns {Promise<MUCMessageAttributes| MessageAttributes|
        import('./types').MUCMessageAttrsWithEncryption|import('./types').MessageAttrsWithEncryption>}
 */
export async function parseEncryptedMessage(stanza, attrs) {
    if (
        api.settings.get('clear_cache_on_logout') ||
        !attrs.is_encrypted ||
        attrs.encryption_namespace !== Strophe.NS.OMEMO
    ) {
        return attrs;
    }
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
        return Object.assign(attrs, {
            error_condition: 'not-encrypted-for-this-device',
            error_type: 'Decryption',
            is_ephemeral: true,
            is_error: true,
            type: 'error',
        });
    }
    // https://xmpp.org/extensions/xep-0384.html#usecases-receiving
    if (attrs.encrypted.prekey === true) {
        return decryptPrekeyWhisperMessage(attrs);
    } else {
        return decryptWhisperMessage(attrs);
    }
}

/**
 * Given an XML element representing a user's OMEMO bundle, parse it
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
        })
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

Object.assign(u, {
    omemo: {
        ...u.omemo,
        parseBundle,
    },
});
