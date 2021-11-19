import { CustomElement } from 'shared/components/element.js';
import tpl_avatar from './templates/avatar.js';
import { _converse, api } from '@converse/headless/core';

import './avatar.scss';


export default class Avatar extends CustomElement {

    static get properties () {
        return {
            data: { type: Object },
            width: { type: String },
            height: { type: String },
            nonce: { type: String }, // Used to trigger rerenders
        }
    }

    constructor () {
        super();
        this.width = 36;
        this.height = 36;
    }

    render  () {
        const image_type = this.data?.image_type || _converse.DEFAULT_IMAGE_TYPE;
        let image;
        if (this.data?.data_uri) {
            image = this.data?.data_uri;
        } else {
            const image_data = this.data?.image || _converse.DEFAULT_IMAGE;
            image = "data:" + image_type + ";base64," + image_data;
        }
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
