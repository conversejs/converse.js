import converse from '../../shared/api/public.js';

const { u, Strophe } = converse.env;

/**
 * The session/identity-key storage prefix for a given OMEMO version. Legacy is
 * unprefixed (`''`) so sessions persisted by older Converse versions keep
 * working without migration; v2 carries a `v2:` prefix.
 * @param {import('./types').OMEMOVersion} version
 */
function prefixForVersion(version) {
    return version === Strophe.NS.OMEMO2 ? 'v2:' : '';
}

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
    /** @type {import('./store.js').default} */
    #base;
    /** @type {import('./types').OMEMOVersion} */
    #version;
    /** @type {string} */
    #prefix;

    /**
     * @param {import('./store.js').default} base_store
     * @param {import('./types').OMEMOVersion} version
     */
    constructor(base_store, version) {
        this.#base = base_store;
        this.#version = version;
        this.#prefix = prefixForVersion(version);
    }

    getIdentityKeyPair() {
        return this.#base.getIdentityKeyPair();
    }
    getLocalRegistrationId() {
        return this.#base.getLocalRegistrationId();
    }

    /** @param {string} address @param {ArrayBuffer} identity_key @param {unknown} direction */
    isTrustedIdentity(address, identity_key, direction) {
        return this.#base.isTrustedIdentity(this.#prefix + address, identity_key, direction);
    }

    /** @param {string} address @param {ArrayBuffer} identity_key */
    saveIdentity(address, identity_key) {
        return this.#base.saveIdentity(this.#prefix + address, identity_key);
    }

    /** @param {string|number} key_id */
    loadPreKey(key_id) {
        return this.#base.loadPreKey(key_id);
    }

    getPreKeys() {
        return this.#base.getPreKeys();
    }

    /** @param {number} key_id @param {import('libomemo.js').KeyPair} key_pair */
    storePreKey(key_id, key_pair) {
        return this.#base.storePreKey(key_id, key_pair);
    }

    /** @param {string|number} key_id */
    removePreKey(key_id) {
        return this.#base.removePreKey(key_id);
    }

    /** @param {string|number} _key_id */
    loadSignedPreKey(_key_id) {
        const attr = this.#version === Strophe.NS.OMEMO2 ? 'signed_prekey_omemo2' : 'signed_prekey';
        const res = this.#base.get(attr);
        if (res) {
            return {
                keyPair: {
                    privKey: u.base64ToArrayBuffer(res.privKey),
                    pubKey: u.base64ToArrayBuffer(res.pubKey),
                },
            };
        }
    }

    /** @param {number} key_id */
    removeSignedPreKey(key_id) {
        return this.#base.removeSignedPreKey(key_id);
    }

    /** @param {string} address */
    loadSession(address) {
        return this.#base.loadSession(this.#prefix + address);
    }

    /** @param {string} address @param {string} record */
    storeSession(address, record) {
        return this.#base.storeSession(this.#prefix + address, record);
    }

    /** @param {string} address */
    removeSession(address) {
        return this.#base.removeSession(this.#prefix + address);
    }

    /** @param {string} [address=''] */
    removeAllSessions(address = '') {
        // We can't delegate to the base store's removeAllSessions: legacy keys
        // are unprefixed (for backward compat), which makes the legacy prefix
        // ('') a string-prefix of every versioned key (e.g. `sessionv2:…`), so a
        // legacy wipe there would also clear v2 sessions. Instead we scope the
        // wipe to this version's keys here, where we know our prefix, and
        // exclude the other versions' prefixes that ours would falsely match.
        const match = 'session' + this.#prefix + address;

        // Only non-empty version prefixes can be falsely matched by ours; the
        // legacy prefix ('') is shorter than every key, so it never needs
        // excluding. So a legacy wipe excludes 'v2:', and a 'v2:' wipe excludes
        // nothing (no other prefix starts with it).
        const exclude = [prefixForVersion(Strophe.NS.OMEMO2)]
            .filter((p) => p !== this.#prefix && p.startsWith(this.#prefix))
            .map((p) => 'session' + p);
        Object.keys(this.#base.attributes)
            .filter((key) => key.startsWith(match) && !exclude.some((e) => key.startsWith(e)))
            .forEach((key) => this.#base.removeSession(key.replace(/^session/, '')));
        return Promise.resolve();
    }
}
