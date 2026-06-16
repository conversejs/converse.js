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
import { decryptMessage, getSessionCipher, sendOMEMOHeartbeat } from './utils.js';
import { getCrypto } from './crypto.js';
import { VersionedOMEMOStore } from './versioned-store.js';
import { decryptSCE } from './sce.js';
import {
    getChatMarker,
    getChatState,
    getOutOfBandAttributes,
    getReferences,
    getReplyAttributes,
    getSpoilerAttributes,
} from '../../shared/parsers.js';

const { Strophe } = converse.env;

// XEP-0384: "When a client receives the first message for a given ratchet key
// with a counter of 53 or higher, it MUST send a heartbeat message."
const HEARTBEAT_COUNTER_THRESHOLD = 53;

// Synchronous guard to prevent concurrent heartbeat sends for the same session.
// Two decryptions arriving in the same tick could both pass the store.loadHeartbeatKey
// check before either storeHeartbeatKey() completes. This Set is checked and mutated
// synchronously (no await), so it closes that window. The store check still handles
// page reloads (the Set is cleared on reload).
const heartbeat_in_flight = new Set();

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
 * @param {MUCMessageAttributes|MessageAttributes} attrs
 * @param {Error} e
 */
function handleDecryptionError(attrs, e) {
    if (e?.name === 'MessageCounterError') {
        // XEP-0384: a message we already decrypted. Ignore it silently.
        log.debug(`Ignoring a duplicate OMEMO message: ${e.message}`);
        return attrs;
    }
    log.error(`OMEMO decryption failed: ${e.name} ${e.message}`);
    return Object.assign(attrs, getDecryptionErrorAttributes(e));
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
    } else if (attrs.type === 'groupchat') {
        // MUC message: from_real_jid is the occupant's real JID, set by the MUC parser.
        from_jid = /** @type {MUCMessageAttributes} */ (attrs).from_real_jid;
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
 * Implements the XEP-0384 heartbeat rule: when we've just decrypted the first
 * message for a given ratchet key whose counter is >= 53, send a heartbeat (an
 * empty OMEMO message) to forward the ratchet. We send at most one heartbeat per
 * ratchet key; the dedup is persisted in the (versioned) OMEMO store so it
 * survives page reloads (the peer only restarts its counter at 0 a round-trip
 * after processing our heartbeat). Best-effort and fire-and-forget — failures
 * are logged, never surfaced to the user.
 *
 * The legacy heartbeat is a `KeyTransportElement` (XEP-0384 0.3.0), which the
 * older protocol defines and conforming clients already handle.
 * @param {MUCMessageAttributes|MessageAttributes} attrs
 * @param {string} from_jid - the (real) bare JID identifying the OMEMO session
 * @param {string|number} device_id - the sender's device id
 * @param {{counter: number, key: ArrayBuffer}|undefined} ratchet - from the decrypt result
 * @param {import('./types').OMEMOVersion} version
 */
async function maybeSendOMEMOHeartbeat(attrs, from_jid, device_id, ratchet, version) {
    if (!ratchet || ratchet.counter < HEARTBEAT_COUNTER_THRESHOLD) return;

    const { OMEMOAddress } = await getCrypto();
    const address = new OMEMOAddress(from_jid, parseInt(`${device_id}`, 10)).toString();
    const ratchet_key_b64 = u.arrayBufferToBase64(ratchet.key);

    if (heartbeat_in_flight.has(address)) return;
    heartbeat_in_flight.add(address);
    try {
        const store = new VersionedOMEMOStore(_converse.state.omemo_store, version);
        if (store.loadHeartbeatKey(address) === ratchet_key_b64) return;

        // Send to the MUC room (groupchat) or the contact (1:1). The session is
        // keyed by the sender's real JID, but the heartbeat is addressed to the chat.
        // For MUC messages, attrs.from is the room JID and attrs.type is 'groupchat'.
        // For 1:1, from_jid is the contact's bare JID (the chatbox key).
        const chat_jid = attrs.type === 'groupchat' ? Strophe.getBareJidFromJid(attrs.from) : from_jid;
        const chat = _converse.state.chatboxes?.get(chat_jid);
        if (!chat) return;

        await sendOMEMOHeartbeat(chat, version);
        await store.storeHeartbeatKey(address, ratchet_key_b64);
    } finally {
        heartbeat_in_flight.delete(address);
    }
}

/**
 * Fire-and-forget wrapper around {@link maybeSendOMEMOHeartbeat}. Logs errors
 * instead of letting them propagate to the caller.
 * @param {MUCMessageAttributes|MessageAttributes} attrs
 * @param {string} from_jid - the (real) bare JID identifying the OMEMO session
 * @param {string|number} device_id - the sender's device id
 * @param {{counter: number, key: ArrayBuffer}|undefined} ratchet - from the decrypt result
 * @param {import('./types').OMEMOVersion} version
 */
function fireHeartbeat(attrs, from_jid, device_id, ratchet, version) {
    maybeSendOMEMOHeartbeat(attrs, from_jid, device_id, ratchet, version).catch((e) =>
        log.error(`Could not send OMEMO heartbeat: ${e}`),
    );
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
        const { plaintext: key_and_tag, ratchet } = await session_cipher.decryptWhisperMessage(key, 'binary');
        const plaintext = await handleDecryptedWhisperMessage(attrs, key_and_tag);
        fireHeartbeat(attrs, from_jid, attrs.encrypted.device_id, ratchet, Strophe.NS.OMEMO);
        if (plaintext) {
            return Object.assign(attrs, { plaintext });
        } else {
            // Empty/heartbeat message (KeyTransportElement with no <payload>).
            return Object.assign(attrs, { 'is_only_key': true });
        }
    } catch (e) {
        return handleDecryptionError(attrs, e);
    }
}

/**
 * @param {MUCMessageAttributes|MessageAttributes} attrs
 */
async function decryptPrekeyWhisperMessage(attrs) {
    const from_jid = getJIDForDecryption(attrs);
    const session_cipher = await getSessionCipher(from_jid, parseInt(attrs.encrypted.device_id, 10));
    const key = u.base64ToArrayBuffer(attrs.encrypted.key);
    let key_and_tag, ratchet;
    try {
        ({ plaintext: key_and_tag, ratchet } = await session_cipher.decryptPreKeyWhisperMessage(key, 'binary'));
    } catch (e) {
        return handleDecryptionError(attrs, e);
    }
    fireHeartbeat(attrs, from_jid, attrs.encrypted.device_id, ratchet, Strophe.NS.OMEMO);
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
 * @param {import('../muc/muc.js').default} [chatbox] - The MUC model (for re-parsing reactions)
 * @returns {Promise<MUCMessageAttributes|MessageAttributes|MUCMessageAttrsWithEncryption|MessageAttrsWithEncryption>}
 */
async function decryptOMEMO2Message(stanza, attrs, chatbox) {
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

    let key_and_tag, ratchet;
    try {
        if (is_kex) {
            ({ plaintext: key_and_tag, ratchet } = await session_cipher.decryptPreKeyWhisperMessage(
                key_bytes,
                'binary',
            ));
            // After handling a key exchange, regenerate and publish prekeys
            const { omemo_store } = _converse.state;
            await omemo_store.generateMissingPreKeys();
            await omemo_store.publishBundle();
        } else {
            ({ plaintext: key_and_tag, ratchet } = await session_cipher.decryptWhisperMessage(key_bytes, 'binary'));
        }
    } catch (e) {
        return handleDecryptionError(attrs, e);
    }

    fireHeartbeat(attrs, from_jid, sender_device_id, ratchet, Strophe.NS.OMEMO2);

    if (!attrs.encrypted.payload) {
        // Empty/heartbeat message
        return Object.assign(attrs, { 'is_only_key': true });
    }

    try {
        const is_muc = attrs.type === 'groupchat';
        const muc_jid = is_muc ? attrs.from : null;
        const { body, content } = await decryptSCE(key_and_tag, attrs.encrypted.payload, {
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

        if (!content) {
            // Payload present but no <content> at all — nothing to surface.
            return Object.assign(attrs, { 'is_only_key': true });
        }

        // A payload-bearing SCE envelope is never a heartbeat (those carry no
        // <payload> and are handled above). Its <content> may hold a <body>
        // with body-coupled metadata (references/reply/oob/spoiler), or it may
        // be a metadata-only message (chat state / marker / reaction) with no
        // <body>. Either way we re-run the normal parsers against the decrypted,
        // authenticated <content> — not the wire stanza, which carries none of
        // this for an encrypted message.
        Object.assign(
            attrs,
            { references: getReferences(content) },
            getReplyAttributes(content),
            getOutOfBandAttributes(content),
            getSpoilerAttributes(content),
        );
        if (body) attrs.plaintext = body;

        // The chat state now travels encrypted inside <content> (it's gated out
        // of the cleartext stanza for encrypted messages), so we read it from
        // there. Chat state and markers are only applied when actually present,
        // so a metadata-only message (e.g. a reaction) gets no spurious chat
        // state and any cleartext one from a non-SCE sender isn't clobbered.
        const chat_state = getChatState(content);
        if (chat_state) attrs.chat_state = chat_state;
        const marker = getChatMarker(content);
        if (marker) {
            attrs.is_marker = true;
            attrs.marker_id = marker.getAttribute('id');
        }
        if (sizzle(`markable[xmlns="${Strophe.NS.MARKERS}"]`, content).length) {
            attrs.is_markable = true;
        }

        /**
         * *Hook* which lets plugins parse metadata from the decrypted SCE
         * `<content>` of an OMEMO:2 message, the same way they parse a wire
         * stanza via `parseMessage`/`parseMUCMessage`. This keeps plugin-specific
         * parsing (e.g. XEP-0444 reactions) in the plugin instead of coupling it
         * to OMEMO. The `chatbox` is forwarded so MUC-aware parsers can resolve
         * room context.
         * @event _converse#parseEncryptedContent
         * @param {Element} content - The decrypted SCE `<content>` element
         * @param {object} attrs - The message attributes parsed so far
         * @param {import('../muc/muc.js').default} [chatbox] - The MUC model, if any
         * @example api.listen.on('parseEncryptedContent', parseReactionsMessage);
         */
        attrs = await api.hook('parseEncryptedContent', content, attrs, chatbox);

        // A content that surfaced nothing the user acts on (no body and no
        // chat state / marker / reaction) is treated as a key-transport message
        // so it isn't shown as a blank message. `reaction_to_id` is added by the
        // reactions plugin via the hook above, so it's not on the base type.
        const has_reaction = !!(/** @type {{reaction_to_id?: string}} */ (attrs)).reaction_to_id;
        if (!body && !attrs.chat_state && !attrs.is_marker && !attrs.is_markable && !has_reaction) {
            return Object.assign(attrs, { 'is_only_key': true });
        }
        return attrs;
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
 * @param {import('../muc/muc.js').default} [chatbox] - The MUC model (only for
 *   `parseMUCMessage`); used to re-parse encrypted reactions from the SCE content.
 * @returns {Promise<MUCMessageAttributes| MessageAttributes|MUCMessageAttrsWithEncryption|MessageAttrsWithEncryption>}
 */
export async function parseEncryptedMessage(stanza, attrs, chatbox) {
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
        return await decryptOMEMO2Message(stanza, attrs, chatbox);
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
