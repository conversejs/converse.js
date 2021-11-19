import { CustomElement } from 'shared/components/element.js';
import tpl_avatar from './templates/avatar.js';
import { api } from '@converse/headless/core';


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
        return tpl_avatar({
            'classes': this.getAttribute('class'),
            'width': this.width,
            'height': this.height,
            'image_type': this.model?.get('image_type'),
            'image': this.model?.get('image')
        });
    }
}

api.elements.define('converse-avatar', Avatar);
