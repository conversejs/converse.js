import 'shared/components/icons.js';
import DOMPurify from 'dompurify';
import { CustomElement } from 'shared/components/element.js';
import { api } from '@converse/headless/core';
import { html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';


export default class ChatHelp extends CustomElement {

    static get properties () {
        return {
            chat_type: { type: String },
            messages: { type: Array },
            model: { type: Object },
            type: { type: String }
        }
    }

    render () {
        const isodate = (new Date()).toISOString();
        return [
            html`<converse-icon class="fas fa-times close-chat-help"
                    @click=${this.close}
                    path-prefix="${api.settings.get("assets_path")}"
                    size="1em"></converse-icon>`,
            ...this.messages.map(m => this.renderHelpMessage({
                isodate,
                'markup': DOMPurify.sanitize(m, {'ALLOWED_TAGS': ['strong']})
            }))
        ];
    }

    close () {
        this.model.set({'show_help_messages': false});
    }

    renderHelpMessage (o) {
        return html`<div class="message chat-${this.type}" data-isodate="${o.isodate}">${unsafeHTML(o.markup)}</div>`;
    }
}

api.elements.define('converse-chat-help', ChatHelp);
