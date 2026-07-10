export function generateDeviceID(): Promise<string>;
export { VersionedOMEMOStore } from "./versioned-store.js";
export default OMEMOStore;
/**
 * @extends {Model<import('./types').OMEMOStoreAttributes>}
 */
declare class OMEMOStore extends Model<import("./types").OMEMOStoreAttributes> {
    constructor(attributes?: Partial<import("./types").OMEMOStoreAttributes>, options?: import("@converse/skeletor").ModelOptions);
    get Direction(): {
        SENDING: number;
        RECEIVING: number;
    };
    /**
     * @returns {import('libomemo.js').KeyPair}
     */
    getIdentityKeyPair(): import("libomemo.js").KeyPair;
    /**
     * @returns {number}
     */
    getLocalRegistrationId(): number;
    /**
     * @param {string} address
     * @param {ArrayBuffer} identity_key
     * @param {unknown} _direction
     * @returns {boolean}
     */
    isTrustedIdentity(address: string, identity_key: ArrayBuffer, _direction: unknown): boolean;
    /**
     * @param {string} address
     * @returns {ArrayBuffer}
     */
    loadIdentityKey(address: string): ArrayBuffer;
    /**
     * @param {string} address
     * @param {ArrayBuffer} identity_key
     * @returns {boolean}
     */
    saveIdentity(address: string, identity_key: ArrayBuffer): boolean;
    getPreKeys(): any;
    /**
     * @param {string|number} key_id
     * @returns {Promise<{ keyPair: import('libomemo.js').KeyPair }|void>}
     */
    loadPreKey(key_id: string | number): Promise<{
        keyPair: import("libomemo.js").KeyPair;
    } | void>;
    /**
     * @param {number} key_id
     * @param {import('libomemo.js').KeyPair} key_pair
     */
    storePreKey(key_id: number, key_pair: import("libomemo.js").KeyPair): void;
    /**
     * @param {string|number} key_id
     */
    removePreKey(key_id: string | number): Promise<void>;
    /**
     * @param {string} _key_id
     * @returns {{ keyPair: import('libomemo.js').KeyPair }|void}
     */
    loadSignedPreKey(_key_id: string): {
        keyPair: import("libomemo.js").KeyPair;
    } | void;
    /**
     * @param {import('libomemo.js').SignedPreKey} spk
     */
    storeSignedPreKey(spk: import("libomemo.js").SignedPreKey): void;
    /**
     * Store the v2 (urn:xmpp:omemo:2) signed prekey. Kept separate from the
     * legacy SPK because the signature covers different bytes (32-byte curve vs
     * 33-byte curve form).
     * @param {import('libomemo.js').SignedPreKey} spk
     */
    storeSignedPreKeyV2(spk: import("libomemo.js").SignedPreKey): void;
    /**
     * @param {number} key_id
     */
    removeSignedPreKey(key_id: number): void;
    /**
     * @param {string} address
     */
    loadSession(address: string): Promise<any>;
    /**
     * @param {string} address
     * @param {object} record
     */
    storeSession(address: string, record: object): Promise<any>;
    /**
     * @param {string} address
     */
    removeSession(address: string): Promise<Awaited<this>>;
    /**
     * The ratchet key (base64) for which we last sent an OMEMO heartbeat to this
     * session, or `undefined`. Used to enforce the XEP-0384 rule of sending at
     * most one heartbeat per ratchet key, in a way that survives page reloads.
     * @param {string} address
     * @returns {string|undefined}
     */
    loadHeartbeatKey(address: string): string | undefined;
    /**
     * Records and persists the ratchet key we just heartbeated for.
     * @param {string} address
     * @param {string} key_b64 - base64 of the ratchet key we just heartbeated for
     * @returns {Promise<void>}
     */
    storeHeartbeatKey(address: string, key_b64: string): Promise<void>;
    /**
     * @param {string} [address='']
     */
    removeAllSessions(address?: string): Promise<void>;
    publishBundle(): Promise<void>;
    generateMissingPreKeys(): Promise<void>;
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
    generatePreKeys(): Promise<{
        id: number;
        key: any;
    }[]>;
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
    generateBundle(): Promise<void>;
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
    ensureV2SignedPreKey(): Promise<boolean>;
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
    ensureProvisioned(): Promise<boolean>;
    /**
     * Restores the persisted OMEMO store, provisioning or repairing it as needed.
     *
     * @returns {Promise<boolean>} Whether key material was (re)generated, so that
     *      the caller knows the bundle changed and must be (re)published.
     */
    fetchSession(): Promise<boolean>;
    #private;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=store.d.ts.map