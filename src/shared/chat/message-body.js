import 'shared/registry.js';
import ImageModal from 'modals/image.js';
import renderRichText from 'shared/directives/rich-text.js';
import { CustomElement } from 'shared/components/element.js';
import { api } from "@converse/headless/core";

import './styles/message-body.scss';


export default class MessageBody extends CustomElement {

    static get properties () {
        return {
            embed_audio: { type: Boolean },
            embed_videos: { type: Boolean },
            hide_url_previews: { type: Boolean },
            is_me_message: { type: Boolean },
            model: { type: Object },
            show_images: { type: Boolean },
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
            'embed_audio': !this.hide_url_previews && this.embed_audio,
            'embed_videos': !this.hide_url_previews && this.embed_videos,
            'nick': this.model.collection.chatbox.get('nick'),
            'onImgClick': (ev) => this.onImgClick(ev),
            'onImgLoad': () => this.onImgLoad(),
            'render_styling': !this.model.get('is_unstyled') && api.settings.get('allow_message_styling'),
            'show_images': !this.hide_url_previews && this.show_images,
            'show_me_message': true
        }
        return renderRichText(this.text, offset, mentions, options, callback);
    }
}

api.elements.define('converse-chat-message-body', MessageBody);
