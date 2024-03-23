import tplGif from 'templates/gif.js';
import tplImage from 'templates/image.js';
import { CustomElement } from './element.js';
import { api } from "@converse/headless";
import { filterQueryParamsFromURL, isGIFURL } from '@converse/headless/utils/url.js';
import { shouldRenderMediaFromURL } from 'utils/url.js';


export default class Image extends CustomElement {

    static get properties () {
        return {
            'src': { type: String },
            'onImgLoad': { type: Function },
            // If specified, image is wrapped in a hyperlink that points to this URL.
            'href': { type: String },
        }
    }

    constructor () {
        super();
        this.src = null;
        this.href = null;
        this.onImgClick = null;
        this.onImgLoad = null;
    }

    render () {
        if (isGIFURL(this.src) && shouldRenderMediaFromURL(this.src, 'image')) {
            return tplGif(filterQueryParamsFromURL(this.src), true);
        } else {
            return tplImage({
                'src': filterQueryParamsFromURL(this.src),
                'href': this.href,
                'onClick': this.onImgClick,
                'onLoad': this.onImgLoad
            });
        }
    }
}

api.elements.define('converse-image', Image);
