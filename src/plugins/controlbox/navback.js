import tplControlboxNavback from "./templates/navback.js";
import { CustomElement } from 'shared/components/element.js';
import { api } from "@converse/headless";


class ControlBoxNavback extends CustomElement {

    static get properties () {
        return {
            'jid': { type: String }
        }
    }

    render () {
        return tplControlboxNavback(this.jid);
    }
}

api.elements.define('converse-controlbox-navback', ControlBoxNavback);

export default ControlBoxNavback;
