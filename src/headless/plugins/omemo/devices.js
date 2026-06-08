import { Collection } from "@converse/skeletor";
import Device from "./device.js";

/**
 * @extends {Collection<Device>}
 */
class Devices extends Collection {
    /**
     * @param {Device[]|object[]} [models]
     * @param {object} [options]
     * @param {import('./types').OMEMOVersion} [options.version]
     */
    constructor(models, options = {}) {
        super(models, options);
        this.model = Device;
        // The OMEMO version this collection belongs to. Stamped onto every
        // device so that Device.isV2() (and thus bundle node selection and
        // parsing) is correct for the contact's devices, not just our own.
        this.version = options.version;
    }

    /**
     * Stamp the collection's OMEMO version onto every device created through it,
     * unless one was explicitly provided.
     * @param {object|Device} attrs
     * @param {object} [options]
     */
    _prepareModel(attrs, options) {
        if (this.version && attrs && !(attrs instanceof Device) && !attrs.version) {
            attrs.version = this.version;
        }
        return super._prepareModel(attrs, options);
    }
}

export default Devices;
