import DeviceList from "./devicelist.js";
import { Collection } from "@converse/skeletor";

class DeviceLists extends Collection {
    constructor() {
        super();
        this.model = DeviceList;
    }
}

export default DeviceLists;
