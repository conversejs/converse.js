import 'shared/registry.js';
import ImageModal from 'modals/image.js';
import renderRichText from 'shared/directives/rich-text.js';
import { CustomElement } from 'shared/components/element.js';
import { api } from "@converse/headless/core";

import './styles/message-body.scss';


export default class MessageBody extends CustomElement {

    static get properties () {
        return {
            // We make this a string instead of a boolean, since we want to
            // distinguish between true, false and undefined states
            hide_url_previews: { type: String },
            is_me_message: { type: Boolean },
            model: { type: Object },
            render_media: { type: Boolean },
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
        const options = {
            'media_urls': this.model.get('media_urls'),
            'mentions': this.model.get('references'),
            'nick': this.model.collection.chatbox.get('nick'),
            'onImgClick': (ev) => this.onImgClick(ev),
            'onImgLoad': () => this.onImgLoad(),
            'render_styling': !this.model.get('is_unstyled') && api.settings.get('allow_message_styling'),
            'show_me_message': true,
        }
        if (this.hide_url_previews === "false") {
            options.embed_audio = true;
            options.embed_videos = true;
            options.show_images = true;
        } else if (this.hide_url_previews === "true") {
            options.embed_audio = false;
            options.embed_videos = false;
            options.show_images = false;
        }
        return renderRichText(this.text, offset, options, callback);
    }
}

api.elements.define('converse-chat-message-body', MessageBody);
