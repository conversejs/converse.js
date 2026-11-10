import { Model } from '@converse/skeletor';
import converse from '../../shared/api/public.js';

const { Strophe } = converse.env;

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
