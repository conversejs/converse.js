export default OMEMOStore;
export type WindowWithLibsignal = any;
declare class OMEMOStore extends Model {
    get Direction(): {
        SENDING: number;
        RECEIVING: number;
    };
    getIdentityKeyPair(): Promise<{
        privKey: any;
        pubKey: any;
    }>;
    getLocalRegistrationId(): Promise<number>;
    isTrustedIdentity(identifier: any, identity_key: any, _direction: any): Promise<boolean>;
    loadIdentityKey(identifier: any): Promise<any>;
    saveIdentity(identifier: any, identity_key: any): Promise<boolean>;
    getPreKeys(): any;
    loadPreKey(key_id: any): Promise<void> | Promise<{
        privKey: any;
        pubKey: any;
    }>;
    storePreKey(key_id: any, key_pair: any): Promise<void>;
    removePreKey(key_id: any): Promise<void>;
    loadSignedPreKey(_keyId: any): Promise<void> | Promise<{
        privKey: any;
        pubKey: any;
    }>;
    storeSignedPreKey(spk: any): Promise<void>;
    removeSignedPreKey(key_id: any): Promise<void>;
    loadSession(identifier: any): Promise<any>;
    storeSession(identifier: any, record: any): Promise<any>;
    removeSession(identifier: any): Promise<false | Awaited<this>>;
    removeAllSessions(identifier: any): Promise<void>;
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
    generatePreKeys(): Promise<any>;
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
import { Model } from "@converse/headless";
//# sourceMappingURL=store.d.ts.map