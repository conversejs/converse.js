import VCard from "./vcard";
import { Collection } from "@converse/skeletor";

class VCards extends Collection {

    constructor () {
        super();
        this.model = VCard;
    }
}

export default VCards;
