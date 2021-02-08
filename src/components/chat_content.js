import "./message-history";
import xss from "xss/dist/xss";
import { CustomElement } from './element.js';
import { html } from 'lit-element';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import { api } from "@converse/headless/core";

export default class ChatContent extends CustomElement {

    static get properties () {
        return {
            chatview: { type: Object}
        }
    }

    connectedCallback () {
        super.connectedCallback();
        const model = this.chatview.model;
        this.listenTo(model.messages, 'add', this.requestUpdate);
        this.listenTo(model.messages, 'change', this.requestUpdate);
        this.listenTo(model.messages, 'remove', this.requestUpdate);
        this.listenTo(model.messages, 'reset', this.requestUpdate);
        this.listenTo(model.notifications, 'change', this.requestUpdate);
        if (model.occupants) {
            this.listenTo(model.occupants, 'change', this.requestUpdate);
        }
    }

    render () {
        const notifications = xss.filterXSS(this.chatview.getNotifications(), {'whiteList': {}});
        return html`
            <converse-message-history
                .chatview=${this.chatview}
                .messages=${[...this.chatview.model.messages.models]}>
            </converse-message-history>
            <div class="chat-content__notifications">${unsafeHTML(notifications)}</div>
        `;
    }
}

api.elements.define('converse-chat-content', ChatContent);
