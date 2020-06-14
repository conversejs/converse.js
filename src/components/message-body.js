import { CustomElement } from './element.js';
import { renderBodyText } from './../templates/directives/body';


class MessageBody extends CustomElement {

    static get properties () {
        return {
            is_me_message: { type: Boolean },
            model: { type: Object },
            text: { type: String },
        }
    }

    render () {
        return renderBodyText(this);
    }
}

customElements.define('converse-chat-message-body', MessageBody);
