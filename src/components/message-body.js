import { CustomElement } from './element.js';
import { renderBodyText } from './../templates/directives/body';
import { api } from "@converse/headless/converse-core";
import ImageModal from '../modals/image.js';


export default class MessageBody extends CustomElement {

    static get properties () {
        return {
            model: { type: Object },
            is_me_message: { type: Boolean },
            text: { type: String },
        }
    }

    showImageModal (ev) {
        ev.preventDefault();
        if (this.image_modal === undefined) {
            this.image_modal = new ImageModal();
        }
        this.image_modal.src = ev.target.src;
        this.image_modal.render();
        this.image_modal.show(ev);
    }

    render () {
        return renderBodyText(this);
    }
}

api.elements.define('converse-chat-message-body', MessageBody);
