/**
 * Strip the leading 0x05 encoding byte from a 33-byte Curve25519 key produced
 * by libomemo.js, returning the raw 32-byte value as base64. Used when
 * publishing v2 bundle elements.
 * @param {string} b64 - base64-encoded 33-byte key
 * @returns {string}
 */
export function stripKeyByte(b64: string): string;
/**
 * Returns the protocol profile for a given OMEMO version.
 * @param {import('./types').OMEMOVersion} version
 * @returns {import('./types').OMEMOProfile}
 */
export function getProfile(version: import("./types").OMEMOVersion): import("./types").OMEMOProfile;
/**
 * Base model for the OMEMO models (Device, DeviceList) that carry an OMEMO
 * protocol version in their `version` attribute, defaulting to the legacy
 * (0.3.0) version when unset.
 * @template {import('../../shared/types').ModelAttributes} [T=import('../../shared/types').ModelAttributes]
 * @extends {Model<T>}
 */
export class OMEMOVersionAwareModel<T extends import("../../shared/types").ModelAttributes = import("../../shared/types").ModelAttributes> extends Model<T> {
    constructor(attributes?: Partial<T>, options?: import("@converse/skeletor").ModelOptions);
    /** @returns {import('./types').OMEMOVersion} */
    getVersion(): import("./types").OMEMOVersion;
    isV2(): boolean;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=profiles.d.ts.map