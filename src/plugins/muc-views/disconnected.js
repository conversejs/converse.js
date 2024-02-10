import tplMUCDisconnect from './templates/muc-disconnect.js';
import { CustomElement } from 'shared/components/element';
import { __ } from 'i18n';
import { _converse, api } from "@converse/headless";


class MUCDisconnected extends CustomElement {

    constructor () {
        super();
        this.jid = null;
    }

    static get properties () {
        return {
            'jid': { type: String }
        }
    }

    connectedCallback () {
        super.connectedCallback();
        this.model = _converse.chatboxes.get(this.jid);
    }

    render () {
        const message = this.model.session.get('disconnection_message');
        if (!message) {
            return;
        }
        const messages = [message];
        const actor = this.model.session.get('disconnection_actor');
        if (actor) {
            messages.push(__('This action was done by %1$s.', actor));
        }
        const reason = this.model.session.get('disconnection_reason');
        if (reason) {
            messages.push(__('The reason given is: "%1$s".', reason));
        }
        return tplMUCDisconnect(messages);
    }
}

api.elements.define('converse-muc-disconnected', MUCDisconnected);
