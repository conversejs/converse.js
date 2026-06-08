export default Devices;
/**
 * @extends {Collection<Device>}
 */
declare class Devices extends Collection<Device> {
    /**
     * @param {Device[]|object[]} [models]
     * @param {object} [options]
     * @param {import('./types').OMEMOVersion} [options.version]
     */
    constructor(models?: Device[] | object[], options?: {
        version?: import("./types").OMEMOVersion;
    });
    model: typeof Device;
    version: import("./types").OMEMOVersion;
    /**
     * Stamp the collection's OMEMO version onto every device created through it,
     * unless one was explicitly provided.
     * @param {object|Device} attrs
     * @param {object} [options]
     */
    _prepareModel(attrs: object | Device, options?: object): Device;
}
import Device from "./device.js";
import { Collection } from "@converse/skeletor";
//# sourceMappingURL=devices.d.ts.map