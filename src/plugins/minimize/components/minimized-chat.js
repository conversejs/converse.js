import tpl_trimmed_chat from "../templates/trimmed_chat.js";
import { CustomElement } from 'shared/components/element.js';
import { api } from "@converse/headless/core";
import { maximize } from  '../utils.js';


export default class MinimizedChat extends CustomElement {

    static get properties () {
        return {
            model: { type: Object },
            title: { type: String },
            type: { type: String },
            num_unread: { type: Number }
        }
    }

    render () {
        const data = {
            'close': ev => this.close(ev),
            'num_unread': this.num_unread,
            'restore': ev => this.restore(ev),
            'title': this.title,
            'type': this.type
        };
        return tpl_trimmed_chat(data);
    }

    close (ev) {
        ev?.preventDefault();
        this.model.close();
    }

    restore (ev) {
        ev?.preventDefault();
        maximize(this.model);
    }
}

api.elements.define('converse-minimized-chat', MinimizedChat);
