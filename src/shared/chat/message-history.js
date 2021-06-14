import "./message";
import { CustomElement } from 'shared/components/element.js';
import { api } from "@converse/headless/core";
import { getDayIndicator } from './utils.js';
import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';


export default class MessageHistory extends CustomElement {

    static get properties () {
        return {
            model: { type: Object },
            messages: { type: Array }
        }
    }

    render () {
        const msgs = this.messages;
        return msgs.length ? html`${repeat(msgs, m => m.get('id'), m => this.renderMessage(m)) }` : '';
    }

    renderMessage (model) {
        if (model.get('dangling_retraction') || model.get('is_only_key')) {
            return '';
        }
        const day = getDayIndicator(model);
        const templates = day ? [day] : [];
        const message = html`<converse-chat-message
            jid="${this.model.get('jid')}"
            mid="${model.get('id')}"></converse-chat-message>`

        return [...templates, message];
    }
}

api.elements.define('converse-message-history', MessageHistory);
