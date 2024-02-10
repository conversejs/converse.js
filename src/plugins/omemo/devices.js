import Device from './device.js';
import { Collection } from '@converse/skeletor';

class Devices extends Collection {

    constructor () {
        super();
        this.model = Device;
    }
}

export default Devices;
