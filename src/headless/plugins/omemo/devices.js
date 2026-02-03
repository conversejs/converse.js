import { Collection } from "@converse/skeletor";
import Device from "./device.js";

/**
 * @extends {Collection<Device>}
 */
class Devices extends Collection {
    constructor() {
        super();
        this.model = Device;
    }
}

export default Devices;
