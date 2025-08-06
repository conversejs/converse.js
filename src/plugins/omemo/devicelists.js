import { Collection } from "@converse/headless";
import DeviceList from "./devicelist.js";

class DeviceLists extends Collection {
    constructor() {
        super();
        this.model = DeviceList;
    }
}

export default DeviceLists;
