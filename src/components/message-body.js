import '../shared/registry.js';
import ImageModal from '../modals/image.js';
import { CustomElement } from './element.js';
import { api } from "@converse/headless/core";
import { renderBodyText } from './../templates/directives/body';


export default class MessageBody extends CustomElement {

    static get properties () {
        return {
            model: { type: Object },
            is_me_message: { type: Boolean },
            text: { type: String },
        }
    }

    showImageModal (ev) { // eslint-disable-line class-methods-use-this
        ev.preventDefault();
        api.modal.create(ImageModal, {'src': ev.target.src}, ev).show(ev);
    }

    render () {
        return renderBodyText(this);
    }
}

api.elements.define('converse-chat-message-body', MessageBody);
