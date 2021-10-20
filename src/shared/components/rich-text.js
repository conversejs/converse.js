import renderRichText from 'shared/directives/rich-text.js';
import { CustomElement } from 'shared/components/element.js';
import { api } from "@converse/headless/core";

import './styles/rich-text.scss';

/**
 * The RichText custom element allows you to parse transform text into rich DOM elements.
 * @example <converse-rich-text text="*_hello_ world!*"></converse-rich-text>
 */
export default class RichText extends CustomElement {

    static get properties () {
        /**
         * @typedef { Object } RichTextComponentProperties
         * @property { Boolean } embed_audio
         *  Whether URLs that point to audio files should render as audio players.
         * @property { Boolean } embed_videos
         *  Whether URLs that point to video files should render as video players.
         * @property { Array } mentions - An array of objects representing chat mentions
         * @property { String } nick - The current user's nickname, relevant for mentions
         * @property { Number } offset - The text offset, in case this is a nested RichText element.
         * @property { Function } onImgClick
         * @property { Function } onImgLoad
         * @property { Boolean } render_styling
         *  Whether XEP-0393 message styling hints should be rendered
         * @property { Boolean } show_images
         *  Whether URLs that point to image files should render as images
         * @property { Boolean } hide_media_urls
         *  If media URLs are rendered as media, then this option determines
         *  whether the original URL is also still shown or not.
         *  Only relevant in conjunction with `show_images`, `embed_audio` and `embed_videos`.
         * @property { Boolean } show_me_message
         *  Whether text that starts with /me should be rendered in the 3rd person.
         * @property { String } text - The text that will get transformed.
         */
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
            hide_media_urls: { type: Boolean },
            show_me_message: { type: Boolean },
            text: { type: String },
        }
    }

    constructor () {
        super();
        this.embed_audio = false;
        this.embed_videos = false;
        this.hide_media_urls = false;
        this.mentions = [];
        this.offset = 0;
        this.render_styling = false;
        this.show_image_urls = true;
        this.show_images = false;
        this.show_me_message = false;
    }

    render () {
        const options = {
            embed_audio: this.embed_audio,
            embed_videos: this.embed_videos,
            hide_media_urls: this.hide_media_urls,
            mentions: this.mentions,
            nick: this.nick,
            onImgClick: this.onImgClick,
            onImgLoad: this.onImgLoad,
            render_styling: this.render_styling,
            show_images: this.show_images,
            show_me_message: this.show_me_message,
        }
        return renderRichText(this.text, this.offset, options);
    }
}

api.elements.define('converse-rich-text', RichText);
