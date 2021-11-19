import tpl_gif from 'templates/gif.js';
import tpl_image from 'templates/image.js';
import { CustomElement } from './element.js';
import { api } from "@converse/headless/core";
import { filterQueryParamsFromURL, isGIFURL } from '@converse/headless/utils/url.js';


export default class Image extends CustomElement {

    static get properties () {
        return {
            'href': { type: String },
            'onImgLoad': { type: Function },
            'text': { type: String },
        }
    }

    render () {
        const filtered_url = filterQueryParamsFromURL(this.href);
        if (isGIFURL(this.text) && this.shouldRenderMedia(this.text, 'image')) {
            return tpl_gif(filtered_url);
        } else {
            return tpl_image({
                'url': this.text,
                'href': filtered_url,
                'onClick': this.onImgClick,
                'onLoad': this.onImgLoad
            });
        }
    }
}

api.elements.define('converse-image', Image);
