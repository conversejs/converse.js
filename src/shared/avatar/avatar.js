import { CustomElement } from 'shared/components/element.js';
import tpl_avatar from './templates/avatar.js';
import { _converse, api } from '@converse/headless/core';


export default class Avatar extends CustomElement {

    static get properties () {
        return {
            model: { type: Object },
            width: { type: String },
            height: { type: String },
        }
    }

    constructor () {
        super();
        this.width = 36;
        this.height = 36;
    }

    render  () {
        const image_type = this.model?.get('image_type') || _converse.DEFAULT_IMAGE_TYPE;
        const image_data = this.model?.get('image') || _converse.DEFAULT_IMAGE;
        const image = "data:" + image_type + ";base64," + image_data;
        return tpl_avatar({
            'classes': this.getAttribute('class'),
            'height': this.height,
            'width': this.width,
            image,
            image_type,
        });
    }
}

api.elements.define('converse-avatar', Avatar);
