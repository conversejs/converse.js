import { Model } from '@converse/skeletor';
import log from '@converse/log';
import _converse from '../../shared/_converse.js';
import converse from '../../shared/api/public.js';
import api from '../../shared/api/index.js';
import { getCrypto } from './crypto.js';
import { getDeviceList } from './utils.js';
export { VersionedOMEMOStore } from './versioned-store.js';

const { Strophe, stx, u } = converse.env;

/**
 * @extends {Model<import('./types').OMEMOStoreAttributes>}
 */
class OMEMOStore extends Model {
    /** @type {Promise<boolean>} */
    #setup_promise;

    get Direction() {
        return {
            SENDING: 1,
            RECEIVING: 2,
        };
    }

    /**
     * @returns {import('libomemo.js').KeyPair}
     */
    getIdentityKeyPair() {
        const keypair = this.get('identity_keypair');
        return {
            privKey: u.base64ToArrayBuffer(keypair.privKey),
            pubKey: u.base64ToArrayBuffer(keypair.pubKey),
        };
    }

    /**
     * @returns {number}
     */
    getLocalRegistrationId() {
        return parseInt(this.get('device_id'), 10);
    }

    /**
     * @param {string} address
     * @param {ArrayBuffer} identity_key
     * @param {unknown} _direction
     * @returns {boolean}
     */
    isTrustedIdentity(address, identity_key, _direction) {
        if (address === null || address === undefined) {
            throw new Error("Can't check identity key for invalid key");
        }
        if (!(identity_key instanceof ArrayBuffer)) {
            throw new Error('Expected identity_key to be an ArrayBuffer');
        }
        const trusted = this.get('identity_key' + address);
        if (trusted === undefined) {
            return true;
        }
        return u.arrayBufferToBase64(identity_key) === trusted;
    }

    /**
     * @param {string} address
     * @returns {ArrayBuffer}
     */
    loadIdentityKey(address) {
        if (address === null || address === undefined) {
            throw new Error("Can't load identity_key for invalid address");
        }
        return u.base64ToArrayBuffer(this.get('identity_key' + address));
    }

    /**
     * @param {string} address
     * @param {ArrayBuffer} identity_key
     * @returns {boolean}
     */
    saveIdentity(address, identity_key) {
        if (address === null || address === undefined) {
            throw new Error("Can't save identity_key for invalid address");
        }
        const existing = this.get('identity_key' + address);
        const b64_idkey = u.arrayBufferToBase64(identity_key);
        this.save('identity_key' + address, b64_idkey);

        if (existing && b64_idkey !== existing) {
            return true;
        } else {
            return false;
        }
    }

    getPreKeys() {
        return this.get('prekeys') || {};
    }

    /**
     * @param {string|number} key_id
     * @returns {Promise<{ keyPair: import('libomemo.js').KeyPair }|void>}
     */
    loadPreKey(key_id) {
        const res = this.getPreKeys()[key_id];
        if (res) {
            return Promise.resolve({
                keyPair: {
                    privKey: u.base64ToArrayBuffer(res.privKey),
                    pubKey: u.base64ToArrayBuffer(res.pubKey),
                },
            });
        }
        return Promise.resolve();
    }

    /**
     * @param {number} key_id
     * @param {import('libomemo.js').KeyPair} key_pair
     */
    storePreKey(key_id, key_pair) {
        const prekey = {
            [key_id]: {
                privKey: u.arrayBufferToBase64(key_pair.privKey),
                pubKey: u.arrayBufferToBase64(key_pair.pubKey),
            },
        };
        this.save('prekeys', Object.assign(this.getPreKeys(), prekey));
    }

    /**
     * @param {string|number} key_id
     */
    removePreKey(key_id) {
        const prekeys = { ...this.getPreKeys() };
        delete prekeys[key_id];
        this.save('prekeys', prekeys);
        return Promise.resolve();
    }

    /**
     * @param {string} _key_id
     * @returns {{ keyPair: import('libomemo.js').KeyPair }|void}
     */
    loadSignedPreKey(_key_id) {
        const res = this.get('signed_prekey');
        if (res) {
            return {
                keyPair: {
                    privKey: u.base64ToArrayBuffer(res.privKey),
                    pubKey: u.base64ToArrayBuffer(res.pubKey),
                },
            };
        }
    }

    /**
     * @param {import('libomemo.js').SignedPreKey} spk
     */
    storeSignedPreKey(spk) {
        if (typeof spk !== 'object') {
            throw new Error('storeSignedPreKey: expected an object');
        }
        this.save('signed_prekey', {
            id: spk.keyId,
            privKey: u.arrayBufferToBase64(spk.keyPair.privKey),
            pubKey: u.arrayBufferToBase64(spk.keyPair.pubKey),
            signature: u.arrayBufferToBase64(spk.signature),
        });
    }

    /**
     * Store the v2 (urn:xmpp:omemo:2) signed prekey. Kept separate from the
     * legacy SPK because the signature covers different bytes (32-byte curve vs
     * 33-byte curve form).
     * @param {import('libomemo.js').SignedPreKey} spk
     */
    storeSignedPreKeyV2(spk) {
        if (typeof spk !== 'object') {
            throw new Error('storeSignedPreKeyV2: expected an object');
        }
        this.save('signed_prekey_omemo2', {
            id: spk.keyId,
            privKey: u.arrayBufferToBase64(spk.keyPair.privKey),
            pubKey: u.arrayBufferToBase64(spk.keyPair.pubKey),
            signature: u.arrayBufferToBase64(spk.signature),
        });
    }

    /**
     * @param {number} key_id
     */
    removeSignedPreKey(key_id) {
        if (this.get('signed_prekey')['id'] === key_id) {
            this.unset('signed_prekey');
            this.save();
        }
    }

    /**
     * @param {string} address
     */
    loadSession(address) {
        return Promise.resolve(this.get('session' + address));
    }

    /**
     * @param {string} address
     * @param {object} record
     */
    storeSession(address, record) {
        return Promise.resolve(this.save('session' + address, record));
    }

    /**
     * @param {string} address
     */
    removeSession(address) {
        // Drop the heartbeat marker (see {@link loadHeartbeatKey}) together with
        // the session, so a rebuilt session starts with a clean slate.
        this.unset('heartbeat:' + address);
        return Promise.resolve(this.unset('session' + address));
    }

    /**
     * The ratchet key (base64) for which we last sent an OMEMO heartbeat to this
     * session, or `undefined`. Used to enforce the XEP-0384 rule of sending at
     * most one heartbeat per ratchet key, in a way that survives page reloads.
     * @param {string} address
     * @returns {string|undefined}
     */
    loadHeartbeatKey(address) {
        return this.get('heartbeat:' + address);
    }

    /**
     * Records and persists the ratchet key we just heartbeated for.
     * @param {string} address
     * @param {string} key_b64 - base64 of the ratchet key we just heartbeated for
     * @returns {Promise<void>}
     */
    storeHeartbeatKey(address, key_b64) {
        return this.save('heartbeat:' + address, key_b64, { promise: true });
    }

    /**
     * @param {string} [address='']
     */
    removeAllSessions(address = '') {
        const keys = Object.keys(this.attributes).filter((key) => (key.startsWith('session' + address) ? key : false));
        const attrs = {};
        keys.forEach((key) => {
            attrs[key] = undefined;
        });
        this.save(attrs);
        return Promise.resolve();
    }

    async publishBundle() {
        // The v2 bundle publish runs in the background: failing it (e.g. on a
        // server that doesn't support omemo:2) must not block legacy OMEMO setup.
        this.#publishV2Bundle().catch((e) => log.error(e));
        await this.#publishLegacyBundle();
        // Record that our bundle reached the server, so we don't needlessly
        // republish it on the next connection (see initOMEMO). Any change to the
        // stored bundle clears this flag again. If the publish above rejected we
        // never get here, so the flag stays false and we retry next time.
        this.save({ bundle_published: true });
    }

    #publishLegacyBundle() {
        const signed_prekey = this.get('signed_prekey');
        const node = `${Strophe.NS.OMEMO_BUNDLES}:${this.get('device_id')}`;
        const item = stx`
            <item>
                <bundle xmlns="${Strophe.NS.OMEMO}">
                    <signedPreKeyPublic signedPreKeyId="${signed_prekey.id}"
                        >${signed_prekey.pubKey}</signedPreKeyPublic>
                    <signedPreKeySignature>${signed_prekey.signature}</signedPreKeySignature>
                    <identityKey>${this.get('identity_keypair').pubKey}</identityKey>
                    <prekeys>${Object.values(this.get('prekeys')).map(
                        (prekey, id) => stx`<preKeyPublic preKeyId="${id}">${prekey.pubKey}</preKeyPublic>`,
                    )}
                    </prekeys>
                </bundle>
            </item>`;
        const options = { access_model: 'open' };
        return api.pubsub.publish(null, node, item, options, false);
    }

    async #publishV2Bundle() {
        const spk = this.get('signed_prekey_omemo2');
        if (!spk) {
            log.warn('No v2 signed prekey found, skipping v2 bundle publication');
            return;
        }
        const { curvePubKeyToEd25519PubKey } = await getCrypto();
        const identity_keypair = this.get('identity_keypair');
        const device_id = this.get('device_id');
        // Unlike legacy 0.3.0 (which uses a per-device node), omemo:2 stores every
        // device's bundle as a separate item — keyed by item id = device id — in
        // the single `urn:xmpp:omemo:2:bundles` node. See XEP-0384 §4.3.2.
        const node = Strophe.NS.OMEMO2_BUNDLES;

        // Ed25519 IK from curve pubkey
        const curve_ik = u.base64ToArrayBuffer(identity_keypair.pubKey);
        const ed25519_ik = await curvePubKeyToEd25519PubKey(curve_ik);
        const ed25519_ik_b64 = u.arrayBufferToBase64(ed25519_ik);

        // Strip leading byte from SPK pubkey (33 → 32 bytes) for v2 wire format
        const spk_pub_raw = u.base64ToArrayBuffer(spk.pubKey);
        const spk_pub_b64 = u.arrayBufferToBase64(spk_pub_raw.slice(1));

        // Prekeys with stripped leading byte
        const prekeys_obj = this.get('prekeys');
        const prekey_items = Object.entries(prekeys_obj).map(([key_id, pk]) => {
            const raw = u.base64ToArrayBuffer(/** @type {{pubKey:string}} */ (pk).pubKey);
            const stripped = u.arrayBufferToBase64(raw.slice(1));
            return stx`<pk id="${key_id}">${stripped}</pk>`;
        });

        const item = stx`
            <item id="${device_id}">
                <bundle xmlns="${Strophe.NS.OMEMO2}">
                    <spk id="${spk.id}">${spk_pub_b64}</spk>
                    <spks>${spk.signature}</spks>
                    <ik>${ed25519_ik_b64}</ik>
                    <prekeys>${prekey_items}</prekeys>
                </bundle>
            </item>`;
        // `max_items=max` is REQUIRED by XEP-0384: the shared bundles node must
        // retain one item per device rather than only the latest.
        const options = { access_model: 'open', max_items: 'max' };
        return api.pubsub.publish(null, node, item, options, false);
    }

    async generateMissingPreKeys() {
        const { KeyHelper } = await getCrypto();

        const prekeyIds = Object.keys(this.getPreKeys());
        const missing_keys = Array.from({ length: _converse.NUM_PREKEYS }, (_, id) => id.toString()).filter(
            (id) => !prekeyIds.includes(id),
        );

        if (missing_keys.length < 1) {
            log.debug('No missing prekeys to generate for our own device');
            return Promise.resolve();
        }

        const keys = await Promise.all(missing_keys.map((id) => KeyHelper.generatePreKey(parseInt(id, 10))));
        keys.forEach((k) => this.storePreKey(k.keyId, k.keyPair));
        // These replacement prekeys aren't on the server yet. The caller
        // republishes right after, but clearing the flag means a failed publish
        // is retried on the next connection rather than silently skipped.
        this.save({ bundle_published: false });

        const prekeys = this.getPreKeys();
        const marshalled_keys = Object.keys(prekeys).map((id) => ({
            id,
            key: prekeys[id].pubKey,
        }));

        const bare_jid = _converse.session.get('bare_jid');
        const devicelist = await getDeviceList(bare_jid);
        const device = devicelist.devices.get(this.get('device_id'));
        const bundle = await device.getBundle();
        device.save('bundle', Object.assign(bundle, { 'prekeys': marshalled_keys }));
    }

    /**
     * Generates, stores and then returns pre-keys.
     *
     * Pre-keys are one half of a X3DH key exchange and are published as part
     * of the device bundle.
     *
     * For a new contact or device to establish an encrypted session, it needs
     * to use a pre-key, which it chooses randomly from the list of available
     * ones.
     */
    async generatePreKeys() {
        const amount = _converse.NUM_PREKEYS;
        const { KeyHelper } = await getCrypto();
        const keys = await Promise.all([...Array(amount).keys()].map((id) => KeyHelper.generatePreKey(id)));

        keys.forEach((k) => this.storePreKey(k.keyId, k.keyPair));

        return keys.map((k) => ({
            id: k.keyId,
            key: u.arrayBufferToBase64(k.keyPair.pubKey),
        }));
    }

    /**
     * Generate the cryptographic data used by the X3DH key agreement protocol
     * in order to build a session with other devices.
     *
     * By generating a bundle, and publishing it via PubSub, we allow other
     * clients to download it and start asynchronous encrypted sessions with us,
     * even if we're offline at that time.
     *
     * Generates both legacy (0.3.0) and v2 (omemo:2) bundle material and
     * publishes both PEP nodes.
     */
    async generateBundle() {
        const { KeyHelper } = await getCrypto();

        // The first thing that needs to happen if a client wants to
        // start using OMEMO is they need to generate an IdentityKey
        // and a Device ID.

        // The IdentityKey is a Curve25519 public/private Key pair.
        const identity_keypair = await KeyHelper.generateIdentityKeyPair();
        const identity_key = u.arrayBufferToBase64(identity_keypair.pubKey);

        // The Device ID is a randomly generated integer between 1 and 2^31 - 1.
        const device_id = await generateDeviceID();

        this.save({
            device_id,
            identity_key,
            identity_keypair: {
                privKey: u.arrayBufferToBase64(identity_keypair.privKey),
                pubKey: identity_key,
            },
            // A freshly generated bundle hasn't reached the server yet.
            bundle_published: false,
        });

        // Generate both legacy and v2 signed prekeys (signatures differ in key encoding).
        const [signed_prekey, signed_prekey_v2] = await Promise.all([
            KeyHelper.generateSignedPreKey(identity_keypair, 0, Strophe.NS.OMEMO),
            KeyHelper.generateSignedPreKey(identity_keypair, 0, Strophe.NS.OMEMO2),
        ]);
        this.storeSignedPreKey(signed_prekey);
        this.storeSignedPreKeyV2(signed_prekey_v2);

        const prekeys = await this.generatePreKeys();

        const bundle = { identity_key, device_id, prekeys };
        bundle['signed_prekey'] = {
            id: signed_prekey.keyId,
            public_key: u.arrayBufferToBase64(signed_prekey.keyPair.pubKey),
            signature: u.arrayBufferToBase64(signed_prekey.signature),
        };

        const bare_jid = _converse.session.get('bare_jid');
        const devicelist = await api.omemo.devicelists.get(bare_jid);
        const device = await devicelist.devices.create({ id: bundle.device_id, 'jid': bare_jid }, { promise: true });
        device.save('bundle', bundle);
    }

    /**
     * Backfills omemo:2 key material for an already provisioned device.
     *
     * Stores created before omemo:2 support have a device_id, identity key and
     * legacy signed prekey, but no `signed_prekey_omemo2`.
     *
     * This generates the missing v2 signed prekey, reusing the existing
     * identity key so our fingerprint and device_id are unchanged. When we
     * generate one, initOMEMO publishes the (now changed) bundle right after
     * the session is restored.
     *
     * @returns {Promise<boolean>} Whether a new v2 signed prekey was generated.
     */
    async ensureV2SignedPreKey() {
        if (this.get('signed_prekey_omemo2') || !this.get('identity_keypair')) {
            return false;
        }
        log.info('Migrating OMEMO store: generating the missing omemo:2 signed prekey');
        const { KeyHelper } = await getCrypto();
        const signed_prekey_v2 = await KeyHelper.generateSignedPreKey(this.getIdentityKeyPair(), 0, Strophe.NS.OMEMO2);
        this.storeSignedPreKeyV2(signed_prekey_v2);
        return true;
    }

    /**
     * Self-heal a partially-provisioned store before its bundle is published.
     *
     * A {@link OMEMOStore#generateBundle} interrupted after persisting the
     * device_id and identity key (e.g. the tab is closed while the 100 prekeys
     * are still being generated) leaves a store with a device_id but missing
     * its signed prekeys and/or one-time prekeys.
     *
     * This backfills whatever key material is missing, reusing the existing
     * identity key and device_id so the fingerprint stays unchanged.
     * It also subsumes the omemo:2 migration for stores created before omemo:2
     * support.
     *
     * @returns {Promise<boolean>} Whether any key material was (re)generated, in
     *      which case the bundle changed and must be republished.
     */
    async ensureProvisioned() {
        let changed = await this.ensureV2SignedPreKey();
        const { KeyHelper } = await getCrypto();
        if (!this.get('signed_prekey')) {
            log.warn('OMEMO store is missing its legacy signed prekey; regenerating it');
            const spk = await KeyHelper.generateSignedPreKey(this.getIdentityKeyPair(), 0, Strophe.NS.OMEMO);
            this.storeSignedPreKey(spk);
            changed = true;
        }
        if (Object.keys(this.getPreKeys()).length === 0) {
            log.warn('OMEMO store has no prekeys (interrupted provisioning?); regenerating them');
            await this.generatePreKeys();
            changed = true;
        }
        if (changed) {
            // The regenerated material is no longer what we last published.
            this.save({ bundle_published: false });
        }
        return changed;
    }

    /**
     * Restores the persisted OMEMO store, provisioning or repairing it as needed.
     *
     * @returns {Promise<boolean>} Whether key material was (re)generated, so that
     *      the caller knows the bundle changed and must be (re)published.
     */
    fetchSession() {
        if (this.#setup_promise === undefined) {
            this.#setup_promise = new Promise(/** @param {(v: boolean) => void} resolve */ (resolve, reject) => {
                this.fetch({
                    success: () => {
                        if (!this.get('device_id') || !this.get('identity_keypair')) {
                            // No store yet, or a generateBundle() interrupted before
                            // the identity key was persisted. (Re)generate a complete
                            // bundle; any half-published device_id is left as an orphan.
                            // A brand-new bundle always needs publishing.
                            this.generateBundle()
                                .then(() => resolve(true))
                                .catch(reject);
                        } else {
                            // Existing store: backfill any missing key material and
                            // report whether that changed the bundle.
                            this.ensureProvisioned()
                                .then(resolve)
                                .catch((e) => {
                                    log.error('Could not repair/migrate the OMEMO store');
                                    log.error(e);
                                    resolve(false);
                                });
                        }
                    },
                    /**
                     * @param {unknown} _model
                     * @param {unknown} resp
                     */
                    error: (_model, resp) => {
                        log.warn(`Could not restore OMEMO session, we'll generate a new one: ${resp}`);
                        this.generateBundle()
                            .then(() => resolve(true))
                            .catch(reject);
                    },
                });
            });
        }
        return this.#setup_promise;
    }
}

export async function generateDeviceID() {
    const { KeyHelper } = await getCrypto();

    /* Generates a device ID, making sure that it's unique */
    const bare_jid = _converse.session.get('bare_jid');
    const devicelist = await getDeviceList(bare_jid, true);
    const existing_ids = devicelist.devices.pluck('id');
    let device_id = KeyHelper.generateRegistrationId();

    // Before publishing a freshly generated device id for the first time,
    // a device MUST check whether that device id already exists, and if so, generate a new one.
    let i = 0;
    while (existing_ids.includes(device_id)) {
        device_id = KeyHelper.generateRegistrationId();
        i++;
        if (i === 10) {
            throw new Error('Unable to generate a unique device ID');
        }
    }
    return device_id.toString();
}

export default OMEMOStore;
