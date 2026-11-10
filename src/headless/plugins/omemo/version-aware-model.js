import { Model } from '@converse/skeletor';
import converse from '../../shared/api/public.js';

const { u, Strophe } = converse.env;

/**
 * Base model for the OMEMO models (Device, DeviceList) that carry an OMEMO
 * protocol version in their `version` attribute, defaulting to the legacy
 * (0.3.0) version when unset.
 * @template {import('../../shared/types').ModelAttributes} [T=import('../../shared/types').ModelAttributes]
 * @extends {Model<T>}
 */
export class OMEMOVersionAwareModel extends Model {
    /** @returns {import('./types').OMEMOVersion} */
    getVersion() {
        return this.get('version') || Strophe.NS.OMEMO;
    }

    isV2() {
        return this.getVersion() === Strophe.NS.OMEMO2;
    }
}

/**
 * Strip the leading 0x05 encoding byte from a 33-byte Curve25519 key produced
 * by libomemo.js, returning the raw 32-byte value as base64. Used when
 * publishing v2 bundle elements.
 * @param {string} b64 - base64-encoded 33-byte key
 * @returns {string}
 */
export function stripKeyByte(b64) {
    const buf = u.base64ToArrayBuffer(b64);
    return u.arrayBufferToBase64(buf.slice(1));
}

/**
 * Returns the protocol profile for a given OMEMO version.
 * @param {import('./types').OMEMOVersion} version
 * @returns {import('./types').OMEMOProfile}
 */
export function getProfile(version) {
    if (version === Strophe.NS.OMEMO2) {
        return {
            version: Strophe.NS.OMEMO2,
            get devicelist_node() {
                return converse.env.Strophe.NS.OMEMO2_DEVICELIST;
            },
            get bundle_node_prefix() {
                return converse.env.Strophe.NS.OMEMO2_BUNDLES;
            },
            usesSCE: true,
            encodePubKey: stripKeyByte,
        };
    }
    return {
        version: Strophe.NS.OMEMO,
        get devicelist_node() {
            return converse.env.Strophe.NS.OMEMO_DEVICELIST;
        },
        get bundle_node_prefix() {
            return converse.env.Strophe.NS.OMEMO_BUNDLES;
        },
        usesSCE: false,
        encodePubKey: (/** @type {string} */ b64) => b64,
    };
}
