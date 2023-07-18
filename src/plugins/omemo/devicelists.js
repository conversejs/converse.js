import DeviceList from './devicelist.js';
import { Collection } from '@converse/skeletor/src/collection';

class DeviceLists extends Collection {

    constructor () {
        super();
        this.model = DeviceList;
    }

}

export default DeviceLists;
