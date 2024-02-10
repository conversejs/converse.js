import VCard from "./vcard";
import { Collection } from "@converse/skeletor";
import { api } from "../../index.js";

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
