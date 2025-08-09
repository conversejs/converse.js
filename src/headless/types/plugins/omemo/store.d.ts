export function generateDeviceID(): Promise<any>;
export default OMEMOStore;
declare class OMEMOStore extends Model {
    /**
     * @typedef {Window & globalThis & {libsignal: any} } WindowWithLibsignal
     */
    get Direction(): {
        SENDING: number;
        RECEIVING: number;
    };
    /**
     * @returns {Promise<import('./types').KeyPair>}
     */
    getIdentityKeyPair(): Promise<import("./types").KeyPair>;
    getLocalRegistrationId(): Promise<number>;
    /**
     * @param {string} identifier
     * @param {ArrayBuffer} identity_key
     * @param {unknown} _direction
     */
    isTrustedIdentity(identifier: string, identity_key: ArrayBuffer, _direction: unknown): Promise<boolean>;
    /**
     * @param {string} identifier
     */
    loadIdentityKey(identifier: string): Promise<any>;
    /**
     * @param {string} identifier
     * @param {string} identity_key
     */
    saveIdentity(identifier: string, identity_key: string): Promise<boolean>;
    getPreKeys(): any;
    /**
     * @param {string} key_id
     */
    loadPreKey(key_id: string): Promise<void> | Promise<{
        privKey: any;
        pubKey: any;
    }>;
    /**
     * @param {string} key_id
     * @param {import('./types').KeyPair} key_pair
     */
    storePreKey(key_id: string, key_pair: import("./types").KeyPair): Promise<void>;
    /**
     * @param {string} key_id
     */
    removePreKey(key_id: string): Promise<void>;
    /**
     * @param {string} _key_id
     * @returns {Promise<import('./types').KeyPair|void>}
     */
    loadSignedPreKey(_key_id: string): Promise<import("./types").KeyPair | void>;
    /**
     * @param {import('./types').SignedPreKey} spk
     */
    storeSignedPreKey(spk: import("./types").SignedPreKey): Promise<void>;
    /**
     * @param {string} key_id
     */
    removeSignedPreKey(key_id: string): Promise<void>;
    /**
     * @param {string} identifier
     */
    loadSession(identifier: string): Promise<any>;
    /**
     * @param {string} identifier
     * @param {object} record
     */
    storeSession(identifier: string, record: object): Promise<any>;
    /**
     * @param {string} identifier
     */
    removeSession(identifier: string): Promise<false | Awaited<this>>;
    /**
     * @param {string} [identifier='']
     */
    removeAllSessions(identifier?: string): Promise<void>;
    publishBundle(): any;
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
        id: any;
        key: any;
    }[]>;
    /**
     * Generate the cryptographic data used by the X3DH key agreement protocol
     * in order to build a session with other devices.
     *
     * By generating a bundle, and publishing it via PubSub, we allow other
     * clients to download it and start asynchronous encrypted sessions with us,
     * even if we're offline at that time.
     */
    generateBundle(): Promise<void>;
    fetchSession(): Promise<any>;
    _setup_promise: Promise<any>;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=store.d.ts.map