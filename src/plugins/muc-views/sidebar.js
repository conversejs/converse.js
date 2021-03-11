import 'shared/autocomplete/index.js';
import tpl_muc_sidebar from "./templates/muc-sidebar.js";
import { CustomElement } from 'components/element.js';
import { api } from "@converse/headless/core";

export default class MUCSidebar extends CustomElement {

    static get properties () {
        return {
            chatroom: { type: Object },
            occupants: { type: Object}
        }
    }

    connectedCallback () {
        super.connectedCallback();
        this.listenTo(this.occupants, 'add', this.requestUpdate);
        this.listenTo(this.occupants, 'remove', this.requestUpdate);
        this.listenTo(this.occupants, 'change', this.requestUpdate);
        this.chatroom.initialized.then(() => this.requestUpdate());
    }

    render () {
        const tpl = tpl_muc_sidebar(Object.assign(
            this.chatroom.toJSON(),
            {'occupants': [...this.occupants.models] }
        ));
        return tpl;
    }
}

api.elements.define('converse-muc-sidebar', MUCSidebar);
