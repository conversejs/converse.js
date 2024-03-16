import VCard from "./vcard";
import api from "./api.js";
import { Collection } from "@converse/skeletor";

class VCards extends Collection {

    constructor () {
        super();
        this.model = VCard;
    }

    initialize () {
        this.on('add', v => v.get('jid') && api.vcard.update(v));
    }
}

export default VCards;
