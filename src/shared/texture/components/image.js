import { api, u } from "@converse/headless";
import { CustomElement } from "shared/components/element";
import tplGif from "shared/texture/templates/gif.js";
import { shouldRenderMediaFromURL, filterQueryParamsFromURL  } from "utils/url.js";
import tplImage from "../templates/image.js";

const { isGIFURL } = u;

export default class Image extends CustomElement {
    static get properties() {
        return {
            src: { type: String },
            onImgLoad: { type: Function },
            // If specified, image is wrapped in a hyperlink that points to this URL.
            href: { type: String },
        };
    }

    constructor() {
        super();
        this.src = null;
        this.href = null;
        this.onImgClick = null;
        this.onImgLoad = null;
    }

    render() {
        if (isGIFURL(this.src) && shouldRenderMediaFromURL(this.src, "image")) {
            return tplGif(filterQueryParamsFromURL(this.src), true);
        } else {
            return tplImage({
                "src": filterQueryParamsFromURL(this.src),
                "href": this.href,
                "onClick": this.onImgClick,
                "onLoad": this.onImgLoad,
            });
        }
    }
}

api.elements.define("converse-image", Image);
