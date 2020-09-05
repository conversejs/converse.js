import { CustomElement } from './element.js';
import tpl_trimmed_chat from "templates/trimmed_chat.js";
import { api, _converse } from "@converse/headless/converse-core";


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
        const view = _converse.chatboxviews.get(this.model.get('id'));
        if (view) {
            // This will call model.destroy(), removing it from the
            // collection and will also emit 'chatBoxClosed'
            view.close();
        } else {
            this.model.destroy();
            api.trigger('chatBoxClosed', this);
        }
    }

    restore (ev) {
        ev?.preventDefault();
        this.model.maximize();
    }
}

api.elements.define('converse-minimized-chat', MinimizedChat);
