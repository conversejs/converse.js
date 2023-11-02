import { Collection } from "@converse/skeletor";
import Resource from "./resource";

class Resources extends Collection {

    constructor () {
        super();
        this.model = Resource;
    }
}

export default Resources;
