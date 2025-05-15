import { Collection } from "@converse/skeletor";
import Presence from "./presence.js";

class Presences extends Collection {
    constructor () {
        super();
        this.model = Presence;
    }
}

export default Presences;
