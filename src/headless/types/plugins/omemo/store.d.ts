export function generateDeviceID(): Promise<string>;
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
     * @param {string} identity_key
     * @returns {boolean}
     */
    saveIdentity(address: string, identity_key: string): boolean;
    getPreKeys(): any;
    /**
     * @param {string} key_id
     * @returns {Promise<{ keyPair: import('libomemo.js').KeyPair }|void>}
     */
    loadPreKey(key_id: string): Promise<{
        keyPair: import("libomemo.js").KeyPair;
    } | void>;
    /**
     * @param {number} key_id
     * @param {import('libomemo.js').KeyPair} key_pair
     */
    storePreKey(key_id: number, key_pair: import("libomemo.js").KeyPair): void;
    /**
     * @param {string} key_id
     */
    removePreKey(key_id: string): Promise<void>;
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
     * @param {string} [address='']
     */
    removeAllSessions(address?: string): Promise<void>;
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
     */
    generateBundle(): Promise<void>;
    fetchSession(): Promise<any>;
    _setup_promise: Promise<any>;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=store.d.ts.map