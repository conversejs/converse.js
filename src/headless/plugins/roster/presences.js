import { Collection } from "@converse/skeletor/src/collection";
import Presence from "./presence.js";

class Presences extends Collection {

    constructor () {
        super();
        this.model = Presence;
    }
}

export default Presences;
