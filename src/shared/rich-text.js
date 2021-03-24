import renderRichText from 'shared/directives/rich-text.js';
import { CustomElement } from 'components/element.js';
import { api } from "@converse/headless/core";

export default class RichText extends CustomElement {

    static get properties () {
        return {
            text: { type: String },
            offset: { type: Number },
            mentions: { type: Array },
            nick: { type: String },
            render_styling: { type: Boolean },
            show_images: { type: Boolean },
            onImgClick: { type: Function },
            onImgLoad: { type: Function }
        }
    }

    render () {
        const options = {
            nick: this.nick,
            render_styling: this.render_styling,
            show_images: this.show_images,
            onImgClick: this.onImgClick,
            onImgLoad: this.onImgLoad,
        }
        return renderRichText(this.text, this.offset, this.mentions, options);
    }
}

api.elements.define('converse-rich-text', RichText);
