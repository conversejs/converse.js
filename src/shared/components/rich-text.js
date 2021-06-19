import renderRichText from 'shared/directives/rich-text.js';
import { CustomElement } from 'shared/components/element.js';
import { api } from "@converse/headless/core";

export default class RichText extends CustomElement {

    static get properties () {
        return {
            embed_audio: { type: Boolean },
            embed_videos: { type: Boolean },
            mentions: { type: Array },
            nick: { type: String },
            offset: { type: Number },
            onImgClick: { type: Function },
            onImgLoad: { type: Function },
            render_styling: { type: Boolean },
            show_images: { type: Boolean },
            show_me_message: { type: Boolean },
            text: { type: String },
        }
    }

    constructor () {
        super();
        this.embed_audio = false;
        this.embed_videos = false;
        this.mentions = [];
        this.offset = 0;
        this.render_styling = false;
        this.show_images = false;
        this.show_me_message = false;
    }

    render () {
        const options = {
            embed_audio: this.embed_audio,
            embed_videos: this.embed_videos,
            nick: this.nick,
            onImgClick: this.onImgClick,
            onImgLoad: this.onImgLoad,
            render_styling: this.render_styling,
            show_images: this.show_images,
            show_me_message: this.show_me_message,
        }
        return renderRichText(this.text, this.offset, this.mentions, options);
    }
}

api.elements.define('converse-rich-text', RichText);
