import sizzle from 'sizzle';
import log from '@converse/log';
import { Model } from '@converse/skeletor';
import converse from '../../shared/api/public.js';
import _converse from '../../shared/_converse.js';
import { constants, errors } from '../../shared/index.js';
import { initStorage } from '../../utils/storage.js';
import api from '../../shared/api/index.js';
import MUC from '../../plugins/muc/muc.js';
import { getCrypto } from './crypto.js';
import { KEY_ALGO, TAG_LENGTH, UNTRUSTED } from './constants.js';
import DeviceLists from './devicelists.js';
import { VersionedOMEMOStore } from './versioned-store.js';
import { encryptSCE, decryptSCE } from './sce.js';

const { u, Strophe, stx } = converse.env;
const { arrayBufferToHex, base64ToArrayBuffer } = u;

// Affiliations whose members are valid recipients of OMEMO-encrypted MUC
// messages (XEP-0384 §MUC). Excludes `outcast` (banned) and `none`.
const OMEMO_MUC_AFFILIATIONS = ['member', 'admin', 'owner'];

/**
 * Returns a VersionedOMEMOStore proxy for the given OMEMO version.
 *
 * The proxy implements the subset of libomemo's `OMEMOStore` interface that
 * `SessionCipher` and `SessionBuilder` actually exercise at runtime (the
 * crypto/session methods); the interface's raw key-value members
 * (`store`/`put`/`get`/`remove`) are part of the reference `InMemoryStore` and
 * are never called on a consumer store, so we present the proxy as an
 * `OMEMOStore` here.
 * @param {import('./types').OMEMOVersion} version
 * @returns {import('libomemo.js').OMEMOStore}
 */
export function getVersionedStore(version) {
    return /** @type {import('libomemo.js').OMEMOStore} */ (
        /** @type {unknown} */ (new VersionedOMEMOStore(_converse.state.omemo_store, version))
    );
}

/**
 * @param {Element} stanza
 */
async function updateDevicesFromStanza(stanza) {
    // Detect which version's devicelist was pushed
    let items_el = sizzle(`items[node="${Strophe.NS.OMEMO_DEVICELIST}"]`, stanza).pop();
    let version = Strophe.NS.OMEMO;

    if (!items_el) {
        items_el = sizzle(`items[node="${Strophe.NS.OMEMO2_DEVICELIST}"]`, stanza).pop();
        if (!items_el) return;
        version = Strophe.NS.OMEMO2;
    }

    let device_ids;
    if (version === Strophe.NS.OMEMO2) {
        const sel = `item devices[xmlns="${Strophe.NS.OMEMO2}"] device`;
        device_ids = sizzle(sel, items_el).map((d) => d.getAttribute('id'));
    } else {
        const sel = `item list[xmlns="${Strophe.NS.OMEMO}"] device`;
        device_ids = sizzle(sel, items_el).map((d) => d.getAttribute('id'));
    }

    const jid = stanza.getAttribute('from');
    const devicelist = await api.omemo.devicelists.get(jid, true, version);
    const devices = devicelist.devices;
    const removed_ids = devices.pluck('id').filter(/** @param {string} id */ (id) => !device_ids.includes(id));

    const bare_jid = _converse.session.get('bare_jid');

    removed_ids.forEach(
        /** @param {string} id */ (id) => {
            if (jid === bare_jid && id === _converse.state.omemo_store.get('device_id')) {
                return; // We don't set the current device as inactive
            }
            devices.get(id).save('active', false);
        },
    );
    device_ids.forEach(
        /** @param {string} device_id */ (device_id) => {
            const device = devices.get(device_id);
            if (device) {
                device.save('active', true);
            } else {
                devices.create({ id: device_id, jid });
            }
        },
    );
    if (u.isSameBareJID(bare_jid, jid)) {
        // Make sure our own device is on the list
        // (i.e. if it was removed, add it again).
        devicelist.publishCurrentDevice(device_ids);
    }
}

/**
 * @param {Element} stanza
 */
async function updateBundleFromStanza(stanza) {
    const items_el = sizzle(`items`, stanza).pop();
    if (!items_el) return;

    const node = items_el.getAttribute('node');
    const item_el = sizzle(`item`, items_el).pop();
    let version, device_id;

    if (node === Strophe.NS.OMEMO2_BUNDLES) {
        // omemo:2: a single bundles node; the device id is the item id.
        version = Strophe.NS.OMEMO2;
        device_id = item_el?.getAttribute('id');
    } else if (node.startsWith(Strophe.NS.OMEMO_BUNDLES + ':')) {
        // legacy 0.3.0: a per-device node, device id is the node suffix.
        version = Strophe.NS.OMEMO;
        device_id = node.slice(Strophe.NS.OMEMO_BUNDLES.length + 1);
    } else {
        return;
    }
    if (!device_id) return;

    const jid = stanza.getAttribute('from');
    const bundle_el = sizzle(`bundle`, item_el).pop();
    const devicelist = await api.omemo.devicelists.get(jid, true, version);
    const device = devicelist.devices.get(device_id) || devicelist.devices.create({ 'id': device_id, jid });

    if (version === Strophe.NS.OMEMO2) {
        const bundle = u.omemo.parseBundleV2(bundle_el);
        device.save({ bundle });
    } else {
        const bundle = u.omemo.parseBundle(bundle_el);
        device.save({ bundle });
    }
}

/**
 * @param {Element} message
 */
async function handlePEPPush(message) {
    try {
        if (sizzle(`event[xmlns="${Strophe.NS.PUBSUB}#event"]`, message).length) {
            await api.waitUntil('OMEMOInitialized');
            await updateDevicesFromStanza(message);
            await updateBundleFromStanza(message);
        }
    } catch (e) {
        log.error(e);
    }
}

/**
 * Register a pubsub handler for devices pushed from other connected clients
 */
export function registerPEPPushHandler() {
    api.connection.get().addHandler(
        /** @param {Element} message */
        (message) => {
            handlePEPPush(message);
            return true;
        },
        null,
        'message',
    );
}

async function fetchDeviceLists() {
    const bare_jid = _converse.session.get('bare_jid');

    _converse.state.devicelists = new DeviceLists();
    const id = `converse.devicelists-${bare_jid}`;
    initStorage(_converse.state.devicelists, id);
    await new Promise((resolve) => {
        _converse.state.devicelists.fetch({
            success: resolve,
            error: (_m, e) => {
                log.error(e);
                resolve();
            },
        });
    });

    _converse.state.devicelists_v2 = new DeviceLists();
    const id_v2 = `converse.devicelists-v2-${bare_jid}`;
    initStorage(_converse.state.devicelists_v2, id_v2);
    await new Promise((resolve) => {
        _converse.state.devicelists_v2.fetch({
            success: resolve,
            error: (_m, e) => {
                log.error(e);
                resolve();
            },
        });
    });

    // Ensure our own legacy device list exists (creates + publishes if needed).
    // This is awaited (unlike the v2 fetch below) because OMEMO initialization
    // depends on it: by the time `session.restore` runs and `OMEMOInitialized`
    // fires, our own device must already be present in (and published to) the
    // legacy device list, otherwise consumers race against `publishCurrentDevice`.
    await api.omemo.devicelists.get(bare_jid, true);
    // Start v2 device list initialization without blocking legacy OMEMO setup.
    // The v2 PEP fetch can take time and failing it (e.g. on servers that don't
    // support omemo:2) must not prevent the legacy path from working.
    api.omemo.devicelists.get(bare_jid, true, Strophe.NS.OMEMO2).catch((e) => log.error(e));
}

/**
 * Loads (and caches on `_converse.state`) the persistent store that remembers
 * whether OMEMO encryption was last enabled or disabled for a given chat.
 *
 * Unlike the chatbox itself (which is removed from storage when the chat is
 * closed), this store persists across chat-close and re-login.
 * @returns {Promise<Model<{id: string}>>}
 */
async function fetchOMEMOActiveStates() {
    if (_converse.state.omemo_active_states) {
        return _converse.state.omemo_active_states;
    }
    const bare_jid = _converse.session.get('bare_jid');
    const id = `converse.omemo-active-states-${bare_jid}`;
    const model = new Model({ id });
    initStorage(model, id);
    await new Promise((resolve) => model.fetch({ success: resolve, error: resolve }));
    _converse.state.omemo_active_states = model;
    return model;
}

/**
 * Returns the remembered OMEMO active state for a chat, or `undefined` if the
 * user has never made an explicit choice for it.
 * @param {string} jid
 * @returns {boolean|undefined}
 */
export function getOMEMOActiveState(jid) {
    return /** @type {boolean|undefined} */ (_converse.state.omemo_active_states?.get(jid));
}

/**
 * Persists the user's explicit choice to enable/disable OMEMO for a chat, so
 * that it's remembered the next time the chat is opened.
 * @param {string} jid
 * @param {boolean} active
 */
export function setOMEMOActiveState(jid, active) {
    _converse.state.omemo_active_states?.save({ [jid]: active });
}

/**
 * @param {boolean} reconnecting
 */
export async function initOMEMO(reconnecting) {
    if (reconnecting) {
        return;
    }
    if (!_converse.state.config.get('trusted') || api.settings.get('clear_cache_on_logout')) {
        log.warn('Not initializing OMEMO, since this browser is not trusted or clear_cache_on_logout is set to true');
        return;
    }
    try {
        await fetchDeviceLists();
        await fetchOMEMOActiveStates();
        await api.omemo.session.restore();
        await _converse.state.omemo_store.publishBundle();
    } catch (e) {
        log.error('Could not initialize OMEMO support');
        log.error(e);
        return;
    }
    /**
     * Triggered once OMEMO support has been initialized
     * @event _converse#OMEMOInitialized
     * @example _converse.api.listen.on('OMEMOInitialized', () => { ... });
     */
    api.trigger('OMEMOInitialized');
}

/**
 * @param {String} jid - The Jabber ID for which the device list will be returned.
 * @param {boolean} [create=false] - Set to `true` if the device list should be
 *      created if it cannot be found.
 * @param {import('./types').OMEMOVersion} [version] - Defaults to legacy version.
 */
export async function getDeviceList(jid, create = false, version = Strophe.NS.OMEMO) {
    const collection = version === Strophe.NS.OMEMO2 ? _converse.state.devicelists_v2 : _converse.state.devicelists;

    const list = collection.get(jid) || (create ? collection.create({ jid, version }) : null);
    await list?.initialized;
    return list;
}

/**
 * @param {import('./device.js').default} device
 */
export async function generateFingerprint(device) {
    if (device.get('bundle')?.fingerprint) {
        return;
    }
    const bundle = await device.getBundle();
    const raw = base64ToArrayBuffer(bundle['identity_key']);
    // For legacy (33-byte Curve25519), strip the leading 0x05 encoding byte
    // so the display fingerprint is always the 64-char (32-byte) key hex.
    // For v2 (32-byte Ed25519), the key has no leading byte.
    const fp_buf = device.isV2 && device.isV2() ? raw : raw.slice(1);
    bundle['fingerprint'] = arrayBufferToHex(fp_buf);
    device.save('bundle', bundle);
    device.trigger('change:bundle'); // Doesn't get triggered automatically due to pass-by-reference
}

/**
 * @param {Error|errors.IQError|errors.UserFacingError} e
 * @param {import('../../shared/chatbox.js').default} chat
 */
export function handleMessageSendError(e, chat) {
    const { __ } = _converse;
    if (e instanceof errors.IQError) {
        chat.save('omemo_supported', false);

        const err_msgs = [];
        if (sizzle(`presence-subscription-required[xmlns="${Strophe.NS.PUBSUB_ERROR}"]`, e.iq).length) {
            err_msgs.push(
                __(
                    "Sorry, we're unable to send an encrypted message because %1$s " +
                        'requires you to be subscribed to their presence in order to see their OMEMO information',
                    e.iq.getAttribute('from'),
                ),
            );
        } else if (sizzle(`remote-server-not-found[xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"]`, e.iq).length) {
            err_msgs.push(
                __(
                    "Sorry, we're unable to send an encrypted message because the remote server for %1$s could not be found",
                    e.iq.getAttribute('from'),
                ),
            );
        } else {
            err_msgs.push(__('Unable to send an encrypted message due to an unexpected error.'));
            err_msgs.push(e.iq.outerHTML);
        }
        api.alert('error', __('Error'), err_msgs);
    } else if (e instanceof errors.UserFacingError) {
        api.alert('error', __('Error'), [e.message]);
    }
    throw e;
}

/**
 * Returns the device collection for a contact and OMEMO version.
 * Doesn't throw on any failure, instead logs and returns an empty collection.
 * @param {string} jid
 * @param {import('./types').OMEMOVersion} [version]
 * @returns {Promise<import('./devices.js').default>}
 */
export async function getDevicesForContact(jid, version = Strophe.NS.OMEMO) {
    await api.waitUntil('OMEMOInitialized');
    try {
        const devicelist = await api.omemo.devicelists.get(jid, true, version);
        await devicelist.fetchDevices();
        // Only force a re-fetch when the previous attempt actually failed (timeout or error).
        if (devicelist.devices.length === 0 && devicelist.lastFetchFailed) {
            await devicelist.fetchDevices(true);
        }
        return devicelist.devices;
    } catch (e) {
        log.error(e);
        return new _converse.exports.Devices(null, { version });
    }
}

/**
 * @param {string} jid
 * @param {number} id
 * @param {import('./types').OMEMOVersion} [version]
 * @returns {Promise<import('libomemo.js').SessionCipher>}
 */
export async function getSessionCipher(jid, id, version = Strophe.NS.OMEMO) {
    const { OMEMOAddress, SessionCipher } = await getCrypto();
    const address = new OMEMOAddress(jid, id);
    const store = getVersionedStore(version);
    return new SessionCipher(store, address, version);
}

/**
 * @param {ArrayBuffer} key_and_tag
 * @param {import('./device').default} device
 * @param {import('./types').OMEMOVersion} [version]
 */
async function encryptKey(key_and_tag, device, version = Strophe.NS.OMEMO) {
    const session_cipher = await getSessionCipher(device.get('jid'), Number(device.get('id')), version);
    const payload = await session_cipher.encrypt(key_and_tag);
    return { payload, device };
}

/**
 * @param {import('./device').default} device
 * @param {import('./types').OMEMOVersion} [version]
 */
async function buildSession(device, version = Strophe.NS.OMEMO) {
    const { OMEMOAddress, SessionBuilder } = await getCrypto();
    const address = new OMEMOAddress(device.get('jid'), device.get('id'));
    const store = getVersionedStore(version);
    const sessionBuilder = new SessionBuilder(store, address, version);
    const prekey = device.getRandomPreKey();
    const bundle = await device.getBundle();
    const device_id = device.get('id');

    return sessionBuilder.processPreKey({
        registrationId: typeof device_id === 'string' ? parseInt(device_id, 10) : device_id,
        identityKey: base64ToArrayBuffer(bundle.identity_key),
        signedPreKey: {
            keyId: bundle.signed_prekey.id, // <Number>
            publicKey: base64ToArrayBuffer(bundle.signed_prekey.public_key),
            signature: base64ToArrayBuffer(bundle.signed_prekey.signature),
        },
        preKey: {
            keyId: prekey.id, // <Number>
            publicKey: base64ToArrayBuffer(prekey.key),
        },
    });
}

/**
 * @param {import('./device').default} device
 * @param {import('./types').OMEMOVersion} [version]
 */
export async function getSession(device, version = Strophe.NS.OMEMO) {
    if (!device.get('bundle')) {
        log.error(`Could not build an OMEMO session for device ${device.get('id')} because we don't have its bundle`);
        return null;
    }
    const { OMEMOAddress } = await getCrypto();
    const address = new OMEMOAddress(device.get('jid'), device.get('id'));
    const store = getVersionedStore(version);
    const session = await store.loadSession(address.toString());
    if (session) {
        return session;
    } else {
        try {
            return await buildSession(device, version);
        } catch (e) {
            log.error(`Could not build an OMEMO session for device ${device.get('id')}`);
            log.error(e);
            return null;
        }
    }
}

/**
 * OMEMO in a MUC requires that real JIDs are visible (non-anonymous) and that
 * the membership is restricted (members-only). This is the single source of
 * truth for that rule.
 * @param {MUC} chatroom
 */
function isOMEMOMUCEligible(chatroom) {
    return !!(chatroom.features.get('nonanonymous') && chatroom.features.get('membersonly'));
}

/**
 * A bundle-fetch error is "actionable" when it tells the user something they
 * can fix and applies to the whole contact/server rather than a single stale
 * device: presence-subscription-required or remote-server-not-found. These must
 * abort the send and be surfaced; any other (benign) per-device failure is
 * dropped silently so it only loses that one device.
 * @param {unknown} e
 * @returns {boolean}
 */
function isActionableBundleError(e) {
    return (
        e instanceof errors.IQError &&
        sizzle(
            `presence-subscription-required[xmlns="${Strophe.NS.PUBSUB_ERROR}"], ` +
                `remote-server-not-found[xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"]`,
            e.iq,
        ).length > 0
    );
}

/**
 * Collects the set of recipient devices for a given chatbox, split by OMEMO
 * version.  Deduplicates across versions (by device id) so each physical
 * device is addressed exactly once. V2 is preferred when both versions are present.
 * @param {import('../../shared/chatbox.js').default} chatbox
 * @returns {Promise<{legacy: import('./device.js').default[], v2: import('./device.js').default[]}>}
 */
async function getBundlesAndBuildSessions(chatbox) {
    const { __ } = _converse;
    const no_devices_err = __('Sorry, no devices found to which we can send an OMEMO encrypted message.');

    let legacy_devices = [];
    let v2_devices = [];

    if (chatbox instanceof MUC) {
        // Defense-in-depth: OMEMO activation is already gated on this upstream
        // (checkOMEMOSupported), but a room can flip to anonymous mid-session.
        if (!isOMEMOMUCEligible(chatbox)) {
            throw new errors.UserFacingError(
                __('Cannot use OMEMO in this groupchat — it must be non-anonymous and members-only.'),
            );
        }
        // Restrict recipients to the member/admin/owner affiliation lists, per
        // XEP-0384 §MUC: the real JIDs of those three lists are the union of
        // OMEMO recipients. This excludes `outcast` (banned) and `none`
        // occupants, so encrypted key material is never addressed to a user who
        // has been removed from the room.
        //
        // Our own devices are included here via the self-occupant (it carries
        // our real JID and an eligible affiliation in a non-anonymous,
        // members-only room); the our_id filter below then drops the sending
        // device, exactly as the 1:1 branch does.
        const occupants = chatbox.occupants.filter(
            /** @param {import('../../plugins/muc/occupant').default} o */
            (o) => o.get('jid') && OMEMO_MUC_AFFILIATIONS.includes(o.get('affiliation')),
        );
        const [legacy_cols, v2_cols] = await Promise.all([
            Promise.all(occupants.map((o) => getDevicesForContact(o.get('jid'), Strophe.NS.OMEMO))),
            Promise.all(occupants.map((o) => getDevicesForContact(o.get('jid'), Strophe.NS.OMEMO2))),
        ]);
        legacy_devices = legacy_cols.flatMap((c) => c.models);
        v2_devices = v2_cols.flatMap((c) => c.models);
    } else if (chatbox.get('type') === constants.PRIVATE_CHAT_TYPE) {
        const contact_jid = chatbox.get('jid');
        const bare_jid = _converse.session.get('bare_jid');

        // Fetch the contact's devices for both versions in parallel (same
        // server, different PEP node), so v2 activates deterministically rather
        // than only when the contact's v2 devicelist happens to already be
        // cached (e.g. from a PEP push). An empty v2 list just means the contact
        // doesn't support omemo:2, in which case we fall back to legacy.
        const [their_legacy, their_v2] = await Promise.all([
            getDevicesForContact(contact_jid, Strophe.NS.OMEMO),
            getDevicesForContact(contact_jid, Strophe.NS.OMEMO2),
        ]);

        // Our own device lists are populated at init, so a cached lookup suffices.
        const [own_legacy_list, own_v2_list] = await Promise.all([
            api.omemo.devicelists.get(bare_jid, false, Strophe.NS.OMEMO),
            api.omemo.devicelists.get(bare_jid, false, Strophe.NS.OMEMO2),
        ]);

        if (their_legacy.length === 0 && their_v2.length === 0) {
            throw new errors.UserFacingError(no_devices_err);
        }

        legacy_devices = [...(own_legacy_list?.devices.models ?? []), ...their_legacy.models];
        v2_devices = [...(own_v2_list?.devices.models ?? []), ...their_v2.models];
    }

    // A device's identity for routing is the (bare JID, id) pair: device ids are
    // unique only per user, so the JID is needed to disambiguate.
    /** @param {string} jid @param {string} id */
    const deviceKey = (jid, id) => `${Strophe.getBareJidFromJid(jid).toLowerCase()}/${id}`;

    // Exclude our own sending device (we encrypt to our other devices, never the
    // one composing the message).
    const our_id = _converse.state.omemo_store.get('device_id');
    const our_key = deviceKey(_converse.session.get('bare_jid'), our_id);
    legacy_devices = legacy_devices.filter((d) => deviceKey(d.get('jid'), d.get('id')) !== our_key);
    v2_devices = v2_devices.filter((d) => deviceKey(d.get('jid'), d.get('id')) !== our_key);

    // Deduplicate across versions: a device that supports both is addressed via
    // omemo:2 only (preferred), so we drop it from the legacy list here and never
    // fetch its legacy bundle.
    const v2_keys = new Set(v2_devices.map((d) => deviceKey(d.get('jid'), d.get('id'))));
    legacy_devices = legacy_devices.filter((d) => !v2_keys.has(deviceKey(d.get('jid'), d.get('id'))));

    // Fetch bundles for the remaining devices. A benign single-device failure
    // (e.g. a stale/orphaned device with no published bundle) must only drop
    // that one device, not abort the whole send — so fetchBundle swallows it and
    // returns null. A genuinely actionable, contact-wide error
    // (presence-subscription-required, remote-server-not-found) is rethrown
    // instead: it aborts the send and propagates to the user, even when our own
    // other devices are still reachable (encrypting only to ourselves would
    // silently leave the intended recipient unable to read the message).
    const fetchBundle = async (d) => {
        try {
            await d.getBundle();
            return d;
        } catch (e) {
            if (isActionableBundleError(e)) throw e;
            log.error(`Skipping device ${d.get('id')} of ${d.get('jid')}: could not fetch its OMEMO bundle`);
            log.error(e);
            return null;
        }
    };
    const [legacy_fetched, v2_fetched] = await Promise.all([
        Promise.all(legacy_devices.map(fetchBundle)),
        Promise.all(v2_devices.map(fetchBundle)),
    ]);
    legacy_devices = legacy_devices.filter((_d, i) => legacy_fetched[i] !== null);
    v2_devices = v2_devices.filter((_d, i) => v2_fetched[i] !== null);

    // Build sessions, dropping devices where session establishment fails.
    const [legacy_sessions, v2_sessions] = await Promise.all([
        Promise.all(legacy_devices.map((d) => getSession(d, Strophe.NS.OMEMO))),
        Promise.all(v2_devices.map((d) => getSession(d, Strophe.NS.OMEMO2))),
    ]);
    legacy_devices = legacy_devices.filter((_d, i) => legacy_sessions[i] !== null);
    v2_devices = v2_devices.filter((_d, i) => v2_sessions[i] !== null);

    if (legacy_devices.length === 0 && v2_devices.length === 0) {
        // Nothing reachable and no actionable server error to explain why.
        throw new errors.UserFacingError(no_devices_err);
    }
    return { legacy: legacy_devices, v2: v2_devices };
}

/**
 * @param {string} plaintext
 * @returns {Promise<import('./types').EncryptedMessage>}
 */
async function encryptMessage(plaintext) {
    // The client MUST use fresh, randomly generated key/IV pairs
    // with AES-128 in Galois/Counter Mode (GCM).

    // For GCM a 12 byte IV is strongly suggested as other IV lengths
    // will require additional calculations. In principle any IV size
    // can be used as long as the IV doesn't ever repeat. NIST however
    // suggests that only an IV size of 12 bytes needs to be supported
    // by implementations.
    //
    // https://crypto.stackexchange.com/questions/26783/ciphertext-and-tag-size-and-iv-transmission-with-aes-in-gcm-mode
    const iv = crypto.getRandomValues(new window.Uint8Array(12));
    const key = await crypto.subtle.generateKey(KEY_ALGO, true, ['encrypt', 'decrypt']);
    const algo = /** @type {AesGcmParams} */ {
        iv,
        name: 'AES-GCM',
        tagLength: TAG_LENGTH,
    };
    const encrypted = await crypto.subtle.encrypt(algo, key, u.stringToArrayBuffer(plaintext));
    const length = encrypted.byteLength - ((128 + 7) >> 3);
    const ciphertext = encrypted.slice(0, length);
    const tag = encrypted.slice(length);
    const exported_key = await crypto.subtle.exportKey('raw', key);
    return {
        tag,
        key: exported_key,
        key_and_tag: u.appendArrayBuffer(exported_key, tag),
        payload: u.arrayBufferToBase64(ciphertext),
        iv: u.arrayBufferToBase64(iv),
    };
}

/**
 * @param {import('./types').EncryptedMessage} obj
 * @returns {Promise<string>}
 */
export async function decryptMessage(obj) {
    const key_obj = await crypto.subtle.importKey('raw', obj.key, KEY_ALGO, true, ['encrypt', 'decrypt']);
    const cipher = u.appendArrayBuffer(u.base64ToArrayBuffer(obj.payload), obj.tag);
    const algo = /** @type {AesGcmParams} */ {
        name: 'AES-GCM',
        iv: u.base64ToArrayBuffer(obj.iv),
        tagLength: TAG_LENGTH,
    };
    return u.arrayBufferToString(await crypto.subtle.decrypt(algo, key_obj, cipher));
}

/**
 * Groups an array of {payload, device} dicts by the device's bare JID.
 * Used to produce <keys jid="..."> groupings in the v2 <encrypted> element.
 * @param {Array<{payload: import('libomemo.js').EncryptResult, device: import('./device.js').default}>} dicts
 * @returns {Map<string, Array<{payload: import('libomemo.js').EncryptResult, device: import('./device.js').default}>>}
 */
function groupByJID(dicts) {
    const map = new Map();
    for (const entry of dicts) {
        const jid = entry.device.get('jid');
        if (!map.has(jid)) map.set(jid, []);
        map.get(jid).push(entry);
    }
    return map;
}

/**
 * Encrypt the given key material with the long-standing OMEMO session of each
 * eligible (trusted + active) recipient device.
 * @param {ArrayBuffer} key_and_tag
 * @param {import('./device').default[]} devices
 * @param {import('./types').OMEMOVersion} version
 */
function encryptKeyForDevices(key_and_tag, devices, version) {
    return Promise.all(
        devices
            .filter((d) => d.get('trusted') != UNTRUSTED && d.get('active'))
            .map((d) => encryptKey(key_and_tag, d, version)),
    );
}

/**
 * Build a legacy (eu.siacs.conversations.axolotl) `<encrypted>` element from
 * the per-device encrypted keys. When `payload` is null the result is a
 * KeyTransportElement (the `<payload>` is omitted), as used for heartbeats.
 * @param {Array<{payload: import('libomemo.js').EncryptResult, device: import('./device.js').default}>} legacy_dicts
 * @param {string} iv
 * @param {string|null} payload
 */
function buildLegacyEncryptedElement(legacy_dicts, iv, payload) {
    const sid = _converse.state.omemo_store.get('device_id');

    // An encrypted header is added to the message for each device that is
    // supposed to receive it. These headers simply contain the key that the
    // payload message is encrypted with, and they are separately encrypted
    // using the session corresponding to the counterpart device.
    return stx`<encrypted xmlns="${Strophe.NS.OMEMO}">
            <header sid="${sid}">
                ${legacy_dicts.map(({ payload: p, device }) => {
                    const prekey = 3 == p.type;
                    if (prekey) {
                        return stx`<key rid="${device.get('id')}" prekey="true">${btoa(p.body)}</key>`;
                    }
                    return stx`<key rid="${device.get('id')}">${btoa(p.body)}</key>`;
                })}
                <iv>${iv}</iv>
            </header>
            ${payload ? stx`<payload>${payload}</payload>` : ''}
        </encrypted>`;
}

/**
 * Build an OMEMO:2 (urn:xmpp:omemo:2) `<encrypted>` element from the per-device
 * encrypted keys. When `payload` is null the `<payload>` is omitted, yielding
 * an empty OMEMO message (used for heartbeats).
 * @param {Array<{payload: import('libomemo.js').EncryptResult, device: import('./device.js').default}>} v2_dicts
 * @param {string|null} payload
 */
function buildOMEMO2EncryptedElement(v2_dicts, payload) {
    // Group keys by recipient JID for the v2 <keys jid='...'> structure
    const by_jid = groupByJID(v2_dicts);
    const keys_elements = [];
    for (const [jid, entries] of by_jid) {
        const key_els = entries.map(({ payload: p, device }) => {
            if (p.kex) {
                return stx`<key rid="${device.get('id')}" kex="true">${btoa(p.body)}</key>`;
            }
            return stx`<key rid="${device.get('id')}">${btoa(p.body)}</key>`;
        });
        keys_elements.push(stx`<keys jid="${jid}">${key_els}</keys>`);
    }

    const sid = _converse.state.omemo_store.get('device_id');

    return stx`<encrypted xmlns="${Strophe.NS.OMEMO2}">
            <header sid="${sid}">${keys_elements}</header>
            ${payload ? stx`<payload>${payload}</payload>` : ''}
        </encrypted>`;
}

/**
 * @param {import('../../shared/message').default} message
 * @param {import('./device').default[]} devices
 */
async function getLegacyEncryptedElement(message, devices) {
    const { key_and_tag, iv, payload } = await encryptMessage(message.get('plaintext'));

    // The 16 bytes key and the GCM authentication tag (The tag
    // SHOULD have at least 128 bit) are concatenated and for each
    // intended recipient device, i.e. both own devices as well as
    // devices associated with the contact, the result of this
    // concatenation is encrypted using the corresponding
    // long-standing OMEMO session.
    const legacy_dicts = await encryptKeyForDevices(key_and_tag, devices, Strophe.NS.OMEMO);
    return buildLegacyEncryptedElement(legacy_dicts, iv, payload);
}

/**
 * Build the metadata elements (XEP-0085 chat state, XEP-0372 references,
 * XEP-0461 reply, OOB url, spoiler) that go inside the OMEMO 2 SCE `<content>`
 * envelope.
 *
 * These mirror the cleartext builders in `createMessageStanza`
 * ({@link module:headless-shared-model-with-messages}), but for encrypted
 * messages they live encrypted inside `<content>` instead of in cleartext — so
 * we don't leak who you mentioned/replied to, nor an XEP-0085 chat state, on
 * every encrypted message. Legacy OMEMO 1 recipients don't get them (its
 * payload is a string, not an element tree) and degrade gracefully.
 * @param {import('../../shared/message').default} message
 * @returns {import('strophe.js').Builder[]}
 */
function getSCEExtensions(message) {
    const { oob_url, is_spoiler, spoiler_hint, references, reply_to_id, reply_to } = message.attributes;
    // The `<active/>` chat state that `createMessageStanza` would otherwise add
    // in cleartext is carried here instead (it's gated out of the cleartext
    // stanza for encrypted messages), so it still clears the recipient's typing
    // indicator without leaking activity metadata to the server.
    const extensions = [stx`<active xmlns="${Strophe.NS.CHATSTATES}"/>`];
    if (oob_url) {
        extensions.push(stx`<x xmlns="${Strophe.NS.OUTOFBAND}"><url>${oob_url}</url></x>`);
    }
    if (is_spoiler) {
        extensions.push(stx`<spoiler xmlns="${Strophe.NS.SPOILER}">${spoiler_hint ?? ''}</spoiler>`);
    }
    references?.forEach((ref) => {
        extensions.push(stx`<reference xmlns="${Strophe.NS.REFERENCE}"
                begin="${ref.begin}"
                end="${ref.end}"
                type="${ref.type}"
                uri="${ref.uri}"></reference>`);
    });
    if (reply_to_id) {
        extensions.push(stx`<reply xmlns="${Strophe.NS.REPLY}" id="${reply_to_id}" to="${reply_to || ''}"></reply>`);
    }
    return extensions;
}

/**
 * @param {import('../../shared/chatbox').default} chat
 * @param {import('../../shared/message').default} message
 * @param {import('./device').default[]} devices
 */
async function getOMEMO2EncryptedElement(chat, message, devices) {
    const is_muc = chat instanceof MUC;
    const muc_jid = is_muc ? chat.get('jid') : null;
    const bare_jid = _converse.session.get('bare_jid');

    // Build SCE envelope and encrypt it. Body-coupled metadata
    // (references/reply/oob/spoiler) is encrypted inside <content>.
    const { key_and_tag, payload } = await encryptSCE(
        message.get('plaintext'),
        { from_jid: bare_jid, to_jid: muc_jid },
        getSCEExtensions(message),
    );

    const v2_dicts = await encryptKeyForDevices(key_and_tag, devices, Strophe.NS.OMEMO2);
    return buildOMEMO2EncryptedElement(v2_dicts, payload);
}

/**
 * Build a legacy heartbeat (KeyTransportElement): a fresh key/IV pair with no
 * `<payload>` (XEP-0384 0.3.0 §Sending a key). Encrypting an empty plaintext
 * with AES-GCM yields a valid 16-byte authentication tag and empty ciphertext,
 * so we reuse {@link encryptMessage} and simply drop the payload.
 * @param {import('./device').default[]} devices
 */
async function getLegacyHeartbeatElement(devices) {
    const { key_and_tag, iv } = await encryptMessage('');
    const legacy_dicts = await encryptKeyForDevices(key_and_tag, devices, Strophe.NS.OMEMO);
    return buildLegacyEncryptedElement(legacy_dicts, iv, null);
}

/**
 * Build an OMEMO:2 heartbeat (empty OMEMO message): per XEP-0384, 32 zero-bytes
 * are encrypted directly with the Double Ratchet session for each device and the
 * `<payload>` is omitted altogether.
 * @param {import('./device').default[]} devices
 */
async function getOMEMO2HeartbeatElement(devices) {
    const zero_bytes = new ArrayBuffer(32);
    const v2_dicts = await encryptKeyForDevices(zero_bytes, devices, Strophe.NS.OMEMO2);
    return buildOMEMO2EncryptedElement(v2_dicts, null);
}

/**
 * Send an OMEMO heartbeat (an empty/payload-less OMEMO message) to `chat` for
 * the given protocol version. Heartbeats forward the Double Ratchet so a peer's
 * message counter restarts at 0; see the XEP-0384 "counter of 53 or higher"
 * rule. The message carries no `<body>`, so it produces no visible/stored chat
 * message. We reuse the normal send-path session setup so every (trusted,
 * active) device gets the heartbeat and any missing sessions are (re)built.
 * @param {import('../../shared/chatbox.js').default} chat
 * @param {import('./types').OMEMOVersion} version
 */
export async function sendOMEMOHeartbeat(chat, version) {
    const is_v2 = version === Strophe.NS.OMEMO2;
    const { legacy, v2 } = await getBundlesAndBuildSessions(chat);
    const devices = is_v2 ? v2 : legacy;
    if (!devices.length) return;

    const encrypted_el = is_v2
        ? await getOMEMO2HeartbeatElement(devices)
        : await getLegacyHeartbeatElement(devices);

    const is_muc = chat instanceof MUC;
    const connection = api.connection.get();
    if (!connection) return;

    const stanza = stx`<message xmlns="jabber:client"
            from="${is_muc ? connection.jid : _converse.session.get('jid')}"
            to="${chat.get('jid')}"
            type="${is_muc ? 'groupchat' : 'chat'}"
            id="${u.getUniqueId()}">
        ${encrypted_el}
        <encryption xmlns="${Strophe.NS.EME}" namespace="${is_v2 ? Strophe.NS.OMEMO2 : Strophe.NS.OMEMO}"/>
        <store xmlns="${Strophe.NS.HINTS}"/>
    </message>`;
    api.send(stanza);
}

/**
 * @param {import('../../shared/chatbox').default} chat
 * @param {import('../../shared/types').MessageAndStanza} data
 * @return {Promise<import('../../shared/types').MessageAndStanza>}
 */
export async function createOMEMOMessageStanza(chat, data) {
    const { stanza } = data;
    const { message } = data;

    if (!message.get('is_encrypted')) return data;
    if (!message.get('body')) throw new Error('No message body to encrypt!');

    const { legacy, v2 } = await getBundlesAndBuildSessions(chat);

    if (legacy.length > 0) {
        stanza.cnode(await getLegacyEncryptedElement(message, legacy)).root();
    }

    if (v2.length > 0) {
        stanza.cnode(await getOMEMO2EncryptedElement(chat, message, v2)).root();
    }

    stanza.cnode(stx`<store xmlns="${Strophe.NS.HINTS}"/>`).root();

    if (v2.length > 0) {
        stanza.cnode(stx`<encryption xmlns="${Strophe.NS.EME}" namespace="${Strophe.NS.OMEMO2}"/>`).root();
    } else if (legacy.length > 0) {
        stanza.cnode(stx`<encryption xmlns="${Strophe.NS.EME}" namespace="${Strophe.NS.OMEMO}"/>`).root();
    }
    return { message, stanza };
}

/**
 * @param {import('../../shared/chatbox.js').default} chat
 * @param {import('../../shared/types').MessageAttributes} attrs
 * @return {import('../../shared/types').MessageAttributes}
 */
export function getOutgoingMessageAttributes(chat, attrs) {
    const { __ } = _converse;
    if (chat.get('omemo_active') && attrs.body) {
        return {
            ...attrs,
            is_encrypted: true,
            plaintext: attrs.body,
            body: __(
                'This is an OMEMO encrypted message which your client doesn’t seem to support. ' +
                    'Find more information on https://conversations.im/omemo',
            ),
        };
    }
    return attrs;
}

/**
 * @param {string} jid
 */
export async function contactHasOMEMOSupport(jid) {
    /* Checks whether the contact advertises any OMEMO-compatible devices. */
    const devices = await u.omemo.getDevicesForContact(jid);
    return devices.length > 0;
}

/**
 * @param {import('../../shared/chatbox.js').default} chatbox
 * @param {boolean} [restore=false] Whether to restore remembered OMEMO active state.
 */
async function checkOMEMOSupported(chatbox, restore = false) {
    // OMEMO is never initialized on an untrusted device (see `initOMEMO`), so
    // `OMEMOInitialized` never resolves and we'd wait forever below. Mark it
    // unsupported up front so the UI doesn't offer encryption. See #2336.
    if (!_converse.state.config.get('trusted')) {
        chatbox.set('omemo_supported', false);
        return;
    }

    let supported;
    if (chatbox.get('type') === constants.CHATROOMS_TYPE) {
        await api.waitUntil('OMEMOInitialized');
        supported = isOMEMOMUCEligible(/** @type {MUC} */ (chatbox));
    } else if (chatbox.get('type') === constants.PRIVATE_CHAT_TYPE) {
        supported = await contactHasOMEMOSupport(chatbox.get('jid'));
    }
    chatbox.set('omemo_supported', !!supported);
    if (supported && restore) {
        // Restore the user's last explicit choice for this chat, falling back
        // to `omemo_default` when no choice has been remembered yet
        const remembered = getOMEMOActiveState(chatbox.get('jid'));
        if (remembered !== undefined) {
            chatbox.set('omemo_active', remembered);
        } else if (api.settings.get('omemo_default')) {
            chatbox.set('omemo_active', true);
        }
    }
}

/**
 * @param {MUC} chatroom
 * @param {import('../../plugins/muc/occupant').default} occupant
 */
async function onOccupantAdded(chatroom, occupant) {
    if (occupant.isSelf() || !isOMEMOMUCEligible(chatroom)) {
        return;
    }
    const { __ } = _converse;
    if (chatroom.get('omemo_active')) {
        const supported = await contactHasOMEMOSupport(occupant.get('jid'));
        if (!supported) {
            chatroom.createMessage({
                'message': __(
                    "%1$s doesn't appear to have a client that supports OMEMO. " +
                        'Encrypted chat will no longer be possible in this grouchat.',
                    occupant.get('nick'),
                ),
                'type': 'error',
            });
            chatroom.save({ 'omemo_active': false, 'omemo_supported': false });
        }
    }
}

/**
 * @param {import('../../shared/chatbox.js').default} chatbox
 */
export function onChatInitialized(chatbox) {
    checkOMEMOSupported(chatbox, true);
    if (chatbox.get('type') === constants.CHATROOMS_TYPE) {
        /** @type {MUC} */ (chatbox).occupants.on(
            'add',
            /** @param {import('../../plugins/muc/occupant').default} o */ (o) =>
                onOccupantAdded(/** @type {MUC} */ (chatbox), o),
        );
        /** @type {MUC} */ (chatbox).features.on('change', () => checkOMEMOSupported(chatbox));
    }
}

/**
 * @param {import('../../shared/message').default} message
 * @param {import('../../shared/types').FileUploadMessageAttributes} attrs
 */
export function setEncryptedFileURL(message, attrs) {
    if (message.file.xep454_ivkey) {
        const url = attrs.oob_url.replace(/^https?:/, 'aesgcm:') + '#' + message.file.xep454_ivkey;
        return {
            ...attrs,
            ...{
                oob_url: null, // Since only the body gets encrypted, we don't set the oob_url
                message: url,
                body: url,
            },
        };
    }
    return attrs;
}

/**
 * @param {File} file
 * @returns {Promise<File>}
 */
export async function encryptFile(file) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await file.arrayBuffer());
    const exported_key = await window.crypto.subtle.exportKey('raw', key);
    const encrypted_file = new File([encrypted], file.name, { type: file.type, lastModified: file.lastModified });

    Object.assign(encrypted_file, { xep454_ivkey: arrayBufferToHex(iv) + arrayBufferToHex(exported_key) });
    return encrypted_file;
}

Object.assign(u, {
    omemo: {
        ...u.omemo,
        decryptMessage,
        decryptSCE,
        encryptMessage,
        encryptSCE,
        generateFingerprint,
        getDevicesForContact,
        getOMEMOActiveState,
        getVersionedStore,
        setOMEMOActiveState,
    },
});
