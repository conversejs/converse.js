import { Collection } from "@converse/skeletor";
import Resource from "./resource";

/**
 * @extends {Collection<Resource>}
 */
class Resources extends Collection {

    constructor () {
        super();
        this.model = Resource;
    }
}

export default Resources;
