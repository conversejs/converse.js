import { Collection } from '@converse/skeletor';
import Device from './device.js';

class Devices extends Collection {

    constructor () {
        super();
        this.model = Device;
    }
}

export default Devices;
