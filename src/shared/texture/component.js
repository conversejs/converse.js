import { LitElement } from 'lit';
import renderTexture from './directive.js';

import './texture.scss';

/**
 * The Texture custom element allows you to parse transform text into rich DOM elements.
 * @example <converse-texture text="*_hello_ world!*"></converse-texture>
 */
export default class Texture extends LitElement {
    static get properties() {
        return {
            embed_audio: { type: Boolean }, // Whether URLs to audio files should render as audio players.
            embed_videos: { type: Boolean }, //  Whether URLs to video files should render as video players.
            mentions: { type: Array }, // An array of objects representing chat mentions
            nick: { type: String }, // The current user's nickname, relevant for mentions
            offset: { type: Number }, // The text offset, in case this is a nested Texture element.
            onImgClick: { type: Function },
            onImgLoad: { type: Function },
            render_styling: { type: Boolean }, //  Whether XEP-0393 message styling hints should be rendered
            show_images: { type: Boolean }, //  Whether URLs to image files should render as images
            // If media URLs are rendered as media, then this option determines
            // whether the original URL is also still shown or not.
            // Only relevant in conjunction with `show_images`, `embed_audio` and `embed_videos`.
            hide_media_urls: { type: Boolean },
            show_me_message: { type: Boolean }, // Whether text that starts with /me is rendered in the 3rd person.
            text: { type: String }, // The text that will get transformed.
        };
    }

    createRenderRoot () {
        // Render without the shadow DOM
        return this;
    }

    constructor() {
        super();
        this.nick = null;
        this.onImgClick = null;
        this.onImgLoad = null;
        this.text = null;
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

    render() {
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
        };
        return renderTexture(this.text, this.offset, options);
    }
}

customElements.define('converse-texture', Texture);
