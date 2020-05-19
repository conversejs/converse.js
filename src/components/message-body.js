import { CustomElement } from './element.js';
import { renderBodyText } from './../templates/directives/body';
import { html } from 'lit-element';


class MessageBody extends CustomElement {

    static get properties () {
        return {
            is_only_emojis: { type: Boolean },
            is_spoiler: { type: Boolean },
            is_spoiler_visible: { type: Boolean },
            is_me_message: { type: Boolean },
            model: { type: Object },
            text: { type: String },
        }
    }

    render () {
        const spoiler_classes = this.is_spoiler ? `spoiler ${this.is_spoiler_visible ? '' : 'collapsed'}` : '';
        return html`
            <div class="chat-msg__text ${this.is_only_emojis ? 'chat-msg__text--larger' : ''} ${spoiler_classes}"
                >${renderBodyText(this)}</div>
        `;
    }

}

customElements.define('converse-chat-message-body', MessageBody);
