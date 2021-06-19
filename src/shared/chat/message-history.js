import "./message";
import { CustomElement } from 'shared/components/element.js';
import { api } from "@converse/headless/core";
import { getDayIndicator } from './utils.js';
import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { until } from 'lit/directives/until.js';


export default class MessageHistory extends CustomElement {

    static get properties () {
        return {
            model: { type: Object },
            messages: { type: Array }
        }
    }

    render () {
        const msgs = this.messages;
        if (msgs.length) {
            return repeat(msgs, m => m.get('id'), m => html`${this.renderMessage(m)}`)
        } else {
            return '';
        }
    }

    renderMessage (model) {
        if (model.get('dangling_retraction') || model.get('is_only_key')) {
            return '';
        }
        const template_hook = model.get('template_hook')
        if (typeof template_hook === 'string') {
            const template_promise = api.hook(template_hook, model, '');
            return until(template_promise, '');
        } else {
            const template = html`<converse-chat-message
                jid="${this.model.get('jid')}"
                mid="${model.get('id')}"></converse-chat-message>`
            const day = getDayIndicator(model);
            return day ? [day, template] : template;
        }
    }
}

api.elements.define('converse-message-history', MessageHistory);
