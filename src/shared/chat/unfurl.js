import tpl_unfurl from './templates/unfurl.js';
import { CustomElement } from 'shared/components/element.js';
import { api } from "@converse/headless/core";
import { getAppSettings } from '@converse/headless/shared/settings/utils.js';

import './styles/unfurl.scss';


export default class MessageUnfurl extends CustomElement {

    static get properties () {
        return {
            description: { type: String },
            image: { type: String },
            jid: { type: String },
            title: { type: String },
            url: { type: String },
        }
    }

    initialize () {
        const settings = getAppSettings();
        this.listenTo(settings, 'change:allowed_image_domains', () => this.requestUpdate());
        this.listenTo(settings, 'change:render_media', () => this.requestUpdate());
    }

    render () {
        return tpl_unfurl(Object.assign({
            'onload': () => this.onImageLoad()
        }, {
            description: this.description || '',
            image: this.image || '',
            title: this.title || '',
            url: this.url || ''
        }));
    }

    onImageLoad () {
        this.dispatchEvent(new CustomEvent('imageLoaded', { detail: this, 'bubbles': true }));
    }
}

api.elements.define('converse-message-unfurl', MessageUnfurl);
