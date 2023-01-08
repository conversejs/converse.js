/* global libsignal */
import difference from 'lodash-es/difference';
import invokeMap from 'lodash-es/invokeMap';
import log from '@converse/headless/log';
import range from 'lodash-es/range';
import omit from 'lodash-es/omit';
import { Model } from '@converse/skeletor/src/model.js';
import { generateDeviceID } from './utils.js';
import { _converse, api, converse } from '@converse/headless/core';

const { Strophe, $build, u } = converse.env;


const OMEMOStore = Model.extend({
    Direction: {
        SENDING: 1,
        RECEIVING: 2
    },

    getIdentityKeyPair () {
        const keypair = this.get('identity_keypair');
        return Promise.resolve({
            'privKey': u.base64ToArrayBuffer(keypair.privKey),
            'pubKey': u.base64ToArrayBuffer(keypair.pubKey)
        });
    },

    getLocalRegistrationId () {
        return Promise.resolve(parseInt(this.get('device_id'), 10));
    },

    isTrustedIdentity (identifier, identity_key, direction) { // eslint-disable-line no-unused-vars
        if (identifier === null || identifier === undefined) {
            throw new Error("Can't check identity key for invalid key");
        }
        if (!(identity_key instanceof ArrayBuffer)) {
            throw new Error('Expected identity_key to be an ArrayBuffer');
        }
        const trusted = this.get('identity_key' + identifier);
        if (trusted === undefined) {
            return Promise.resolve(true);
        }
        return Promise.resolve(u.arrayBufferToBase64(identity_key) === trusted);
    },

    loadIdentityKey (identifier) {
        if (identifier === null || identifier === undefined) {
            throw new Error("Can't load identity_key for invalid identifier");
        }
        return Promise.resolve(u.base64ToArrayBuffer(this.get('identity_key' + identifier)));
    },

    saveIdentity (identifier, identity_key) {
        if (identifier === null || identifier === undefined) {
            throw new Error("Can't save identity_key for invalid identifier");
        }
        const address = new libsignal.SignalProtocolAddress.fromString(identifier);
        const existing = this.get('identity_key' + address.getName());
        const b64_idkey = u.arrayBufferToBase64(identity_key);
        this.save('identity_key' + address.getName(), b64_idkey);

        if (existing && b64_idkey !== existing) {
            return Promise.resolve(true);
        } else {
            return Promise.resolve(false);
        }
    },

    getPreKeys () {
        return this.get('prekeys') || {};
    },

    loadPreKey (key_id) {
        const res = this.getPreKeys()[key_id];
        if (res) {
            return Promise.resolve({
                'privKey': u.base64ToArrayBuffer(res.privKey),
                'pubKey': u.base64ToArrayBuffer(res.pubKey)
            });
        }
        return Promise.resolve();
    },

    storePreKey (key_id, key_pair) {
        const prekey = {};
        prekey[key_id] = {
            'pubKey': u.arrayBufferToBase64(key_pair.pubKey),
            'privKey': u.arrayBufferToBase64(key_pair.privKey)
        };
        this.save('prekeys', Object.assign(this.getPreKeys(), prekey));
        return Promise.resolve();
    },

    removePreKey (key_id) {
        this.save('prekeys', omit(this.getPreKeys(), key_id));
        return Promise.resolve();
    },

    loadSignedPreKey (keyId) { // eslint-disable-line no-unused-vars
        const res = this.get('signed_prekey');
        if (res) {
            return Promise.resolve({
                'privKey': u.base64ToArrayBuffer(res.privKey),
                'pubKey': u.base64ToArrayBuffer(res.pubKey)
            });
        }
        return Promise.resolve();
    },

    storeSignedPreKey (spk) {
        if (typeof spk !== 'object') {
            // XXX: We've changed the signature of this method from the
            // example given in InMemorySignalProtocolStore.
            // Should be fine because the libsignal code doesn't
            // actually call this method.
            throw new Error('storeSignedPreKey: expected an object');
        }
        this.save('signed_prekey', {
            'id': spk.keyId,
            'privKey': u.arrayBufferToBase64(spk.keyPair.privKey),
            'pubKey': u.arrayBufferToBase64(spk.keyPair.pubKey),
            // XXX: The InMemorySignalProtocolStore does not pass
            // in or store the signature, but we need it when we
            // publish our bundle and this method isn't called from
            // within libsignal code, so we modify it to also store
            // the signature.
            'signature': u.arrayBufferToBase64(spk.signature)
        });
        return Promise.resolve();
    },

    removeSignedPreKey (key_id) {
        if (this.get('signed_prekey')['id'] === key_id) {
            this.unset('signed_prekey');
            this.save();
        }
        return Promise.resolve();
    },

    loadSession (identifier) {
        return Promise.resolve(this.get('session' + identifier));
    },

    storeSession (identifier, record) {
        return Promise.resolve(this.save('session' + identifier, record));
    },

    removeSession (identifier) {
        return Promise.resolve(this.unset('session' + identifier));
    },

    removeAllSessions (identifier) {
        const keys = Object.keys(this.attributes).filter(key =>
            key.startsWith('session' + identifier) ? key : false
        );
        const attrs = {};
        keys.forEach(key => { attrs[key] = undefined; });
        this.save(attrs);
        return Promise.resolve();
    },

    publishBundle () {
        const signed_prekey = this.get('signed_prekey');
        const node = `${Strophe.NS.OMEMO_BUNDLES}:${this.get('device_id')}`;
        const item = $build('item')
            .c('bundle', { 'xmlns': Strophe.NS.OMEMO })
                .c('signedPreKeyPublic', { 'signedPreKeyId': signed_prekey.id })
                    .t(signed_prekey.pubKey).up()
                .c('signedPreKeySignature')
                    .t(signed_prekey.signature).up()
                .c('identityKey')
                    .t(this.get('identity_keypair').pubKey).up()
                .c('prekeys');

        Object.values(this.get('prekeys')).forEach((prekey, id) =>
            item
                .c('preKeyPublic', { 'preKeyId': id })
                .t(prekey.pubKey)
                .up()
        );
        const options = { 'pubsub#access_model': 'open' };
        return api.pubsub.publish(null, node, item, options, false);
    },

    async generateMissingPreKeys () {
        const missing_keys = difference(
            invokeMap(range(0, _converse.NUM_PREKEYS), Number.prototype.toString),
            Object.keys(this.getPreKeys())
        );
        if (missing_keys.length < 1) {
            log.warn('No missing prekeys to generate for our own device');
            return Promise.resolve();
        }
        const keys = await Promise.all(
            missing_keys.map(id => libsignal.KeyHelper.generatePreKey(parseInt(id, 10)))
        );
        keys.forEach(k => this.storePreKey(k.keyId, k.keyPair));
        const marshalled_keys = Object.keys(this.getPreKeys()).map(k => ({
            'id': k.keyId,
            'key': u.arrayBufferToBase64(k.pubKey)
        }));
        const devicelist = await api.omemo.devicelists.get(_converse.bare_jid);
        const device = devicelist.devices.get(this.get('device_id'));
        const bundle = await device.getBundle();
        device.save('bundle', Object.assign(bundle, { 'prekeys': marshalled_keys }));
    },

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
    async generatePreKeys () {
        const amount = _converse.NUM_PREKEYS;
        const { KeyHelper } = libsignal;
        const keys = await Promise.all(
            range(0, amount).map(id => KeyHelper.generatePreKey(id))
        );

        keys.forEach(k => this.storePreKey(k.keyId, k.keyPair));

        return keys.map(k => ({
            'id': k.keyId,
            'key': u.arrayBufferToBase64(k.keyPair.pubKey)
        }));
    },

    /**
     * Generate the cryptographic data used by the X3DH key agreement protocol
     * in order to build a session with other devices.
     *
     * By generating a bundle, and publishing it via PubSub, we allow other
     * clients to download it and start asynchronous encrypted sessions with us,
     * even if we're offline at that time.
     */
    async generateBundle () {
        // The first thing that needs to happen if a client wants to
        // start using OMEMO is they need to generate an IdentityKey
        // and a Device ID.

        // The IdentityKey is a Curve25519 public/private Key pair.
        const identity_keypair = await libsignal.KeyHelper.generateIdentityKeyPair();
        const identity_key = u.arrayBufferToBase64(identity_keypair.pubKey);

        // The Device ID is a randomly generated integer between 1 and 2^31 - 1.
        const device_id = await generateDeviceID();

        this.save({
            'device_id': device_id,
            'identity_keypair': {
                'privKey': u.arrayBufferToBase64(identity_keypair.privKey),
                'pubKey': identity_key
            },
            'identity_key': identity_key
        });

        const signed_prekey = await libsignal.KeyHelper.generateSignedPreKey(identity_keypair, 0);
        this.storeSignedPreKey(signed_prekey);

        const prekeys = await this.generatePreKeys();

        const bundle = { identity_key, device_id, prekeys };
        bundle['signed_prekey'] = {
            'id': signed_prekey.keyId,
            'public_key': u.arrayBufferToBase64(signed_prekey.keyPair.pubKey),
            'signature': u.arrayBufferToBase64(signed_prekey.signature)
        };

        const devicelist = await api.omemo.devicelists.get(_converse.bare_jid);
        const device = await devicelist.devices.create(
            { 'id': bundle.device_id, 'jid': _converse.bare_jid },
            { 'promise': true }
        );
        device.save('bundle', bundle);
    },

    fetchSession () {
        if (this._setup_promise === undefined) {
            this._setup_promise = new Promise((resolve, reject) => {
                this.fetch({
                    'success': () => {
                        if (!this.get('device_id')) {
                            this.generateBundle().then(resolve).catch(reject);
                        } else {
                            resolve();
                        }
                    },
                    'error': (model, resp) => {
                        log.warn("Could not fetch OMEMO session from cache, we'll generate a new one.");
                        log.warn(resp);
                        this.generateBundle().then(resolve).catch(reject);
                    }
                });
            });
        }
        return this._setup_promise;
    }
});

export default OMEMOStore;
