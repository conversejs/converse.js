import tpl_controlbox_navback from "./templates/navback.js";
import { CustomElement } from 'shared/components/element.js';
import { api } from "@converse/headless/core";


class ControlBoxNavback extends CustomElement {

    static get properties () {
        return {
            'jid': { type: String }
        }
    }

    render () {
        return tpl_controlbox_navback(this.jid);
    }
}

api.elements.define('converse-controlbox-navback', ControlBoxNavback);

export default ControlBoxNavback;
