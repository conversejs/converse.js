import 'shared/registry.js';
import ImageModal from 'modals/image.js';
import renderRichText from 'shared/directives/rich-text.js';
import { CustomElement } from 'components/element.js';
import { api } from "@converse/headless/core";


export default class MessageBody extends CustomElement {

    static get properties () {
        return {
            model: { type: Object },
            is_me_message: { type: Boolean },
            text: { type: String },
        }
    }

    onImgClick (ev) { // eslint-disable-line class-methods-use-this
        ev.preventDefault();
        api.modal.create(ImageModal, {'src': ev.target.src}, ev).show(ev);
    }

    onImgLoad () {
        this.dispatchEvent(new CustomEvent('imageLoaded', { detail: this, 'bubbles': true }));
    }

    render () {
        const callback = () => this.model.collection?.trigger('rendered', this.model);
        const offset = 0;
        const mentions = this.model.get('references');
        const options = {
            'nick': this.model.collection.chatbox.get('nick'),
            'onImgClick': this.onImgClick,
            'onImgLoad': () => this.onImgLoad(),
            'render_styling': !this.model.get('is_unstyled') && api.settings.get('allow_message_styling'),
            'show_images': api.settings.get('show_images_inline'),
        }
        return renderRichText(this.text, offset, mentions, options, callback);
    }
}

api.elements.define('converse-chat-message-body', MessageBody);
