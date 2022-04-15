import tpl_gif from 'templates/gif.js';
import tpl_image from 'templates/image.js';
import { CustomElement } from './element.js';
import { api } from "@converse/headless/core";
import { filterQueryParamsFromURL, isGIFURL, shouldRenderMediaFromURL } from '@converse/headless/utils/url.js';


export default class Image extends CustomElement {

    static get properties () {
        return {
            'src': { type: String },
            'onImgLoad': { type: Function },
            // If specified, image is wrapped in a hyperlink that points to this URL.
            'href': { type: String },
        }
    }

    render () {
        if (isGIFURL(this.src) && shouldRenderMediaFromURL(this.src, 'image')) {
            return tpl_gif(filterQueryParamsFromURL(this.src), true);
        } else {
            return tpl_image({
                'src': filterQueryParamsFromURL(this.src),
                'href': this.href,
                'onClick': this.onImgClick,
                'onLoad': this.onImgLoad
            });
        }
    }
}

api.elements.define('converse-image', Image);
