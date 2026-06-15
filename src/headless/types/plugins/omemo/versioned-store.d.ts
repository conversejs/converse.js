/**
 * A thin proxy around OMEMOStore that namespaces session and identity-key
 * storage by OMEMO version.  Legacy sessions use unprefixed keys (no
 * migration needed); v2 sessions use a `v2:` prefix so the two protocol
 * versions never collide inside the same underlying model.
 *
 * Prekeys and the identity keypair are shared across both versions — only
 * the signed prekey and the session/trust data are version-specific.
 */
export class VersionedOMEMOStore {
    /**
     * @param {import('./store.js').default} base_store
     * @param {import('./types').OMEMOVersion} version
     */
    constructor(base_store: import("./store.js").default, version: import("./types").OMEMOVersion);
    getIdentityKeyPair(): import("libomemo.js").KeyPair;
    getLocalRegistrationId(): number;
    /** @param {string} address @param {ArrayBuffer} identity_key @param {unknown} direction */
    isTrustedIdentity(address: string, identity_key: ArrayBuffer, direction: unknown): boolean;
    /** @param {string} address @param {ArrayBuffer} identity_key */
    saveIdentity(address: string, identity_key: ArrayBuffer): boolean;
    /** @param {string|number} key_id */
    loadPreKey(key_id: string | number): Promise<void | {
        keyPair: import("libomemo.js").KeyPair;
    }>;
    getPreKeys(): any;
    /** @param {number} key_id @param {import('libomemo.js').KeyPair} key_pair */
    storePreKey(key_id: number, key_pair: import("libomemo.js").KeyPair): void;
    /** @param {string|number} key_id */
    removePreKey(key_id: string | number): Promise<void>;
    /** @param {string|number} _key_id */
    loadSignedPreKey(_key_id: string | number): {
        keyPair: {
            privKey: any;
            pubKey: any;
        };
    };
    /** @param {number} key_id */
    removeSignedPreKey(key_id: number): void;
    /** @param {string} address */
    loadSession(address: string): Promise<any>;
    /** @param {string} address @param {string} record */
    storeSession(address: string, record: string): Promise<any>;
    /** @param {string} address */
    removeSession(address: string): Promise<import("./store.js").default>;
    /** @param {string} address @returns {string|undefined} */
    loadHeartbeatKey(address: string): string | undefined;
    /** @param {string} address @param {string} key_b64 @returns {Promise<void>} */
    storeHeartbeatKey(address: string, key_b64: string): Promise<void>;
    /** @param {string} [address=''] */
    removeAllSessions(address?: string): Promise<void>;
    #private;
}
//# sourceMappingURL=versioned-store.d.ts.map