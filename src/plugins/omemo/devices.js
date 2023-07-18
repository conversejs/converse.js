import Device from './device.js';
import { Collection } from '@converse/skeletor/src/collection';

class Devices extends Collection {

    constructor () {
        super();
        this.model = Device;
    }
}

export default Devices;
