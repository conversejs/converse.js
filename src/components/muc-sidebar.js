import "./autocomplete.js"
import tpl_muc_sidebar from "templates/muc_sidebar.js";
import { CustomElement } from './element.js';
import { api, converse } from "@converse/headless/converse-core";

const u = converse.env.utils;


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
    }

    render () {
        const tpl = tpl_muc_sidebar(Object.assign(
            this.chatroom.toJSON(),
            {'occupants': [...this.occupants.models] }
        ));
        return tpl;
    }

    shouldShow () {
        return !this.chatroom.get('hidden_occupants') &&
            this.chatroom.session.get('connection_status') === converse.ROOMSTATUS.ENTERED;
    }

    setVisibility () {
        // TODO: We're still manually showing/hiding stuff in ChatRoomView,
        // eventually we want everything to render declaratively, after which this
        // method won't be necessary anymore
        this.shouldShow() ? u.showElement(this) : u.hideElement(this);
    }
}

api.elements.define('converse-muc-sidebar', MUCSidebar);
