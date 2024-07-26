import { api } from "@converse/headless";
import tplTrimmedChat from "./templates/trimmed_chat.js";
import { CustomElement } from 'shared/components/element.js';
import { maximize } from  './utils.js';


export default class MinimizedChat extends CustomElement {

    static get properties () {
        return {
            model: { type: Object },
            title: { type: String },
            type: { type: String },
            num_unread: { type: Number }
        }
    }

    constructor () {
        super();
        this.model = null;
        this.num_unread = null;
        this.type = null;
        this.title = null;
    }

    render () {
        return tplTrimmedChat(this);
    }

    /**
     * @param {MouseEvent} ev
     */
    close (ev) {
        ev?.preventDefault();
        this.model.close();
    }

    /**
     * @param {MouseEvent} ev
     */
    restore (ev) {
        ev?.preventDefault();
        maximize(this.model);
    }
}

api.elements.define('converse-minimized-chat', MinimizedChat);
