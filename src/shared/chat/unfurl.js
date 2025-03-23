import { api } from "@converse/headless";
import { CustomElement } from 'shared/components/element.js';
import tplUnfurl from './templates/unfurl.js';

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

    constructor () {
        super();
        this.jid = null;
        this.url = null;
        this.title = null;
        this.image = null;
        this.description = null;
    }

    initialize () {
        const settings = api.settings.get();
        this.listenTo(settings, 'change:allowed_image_domains', () => this.requestUpdate());
        this.listenTo(settings, 'change:render_media', () => this.requestUpdate());
    }

    render () {
        return tplUnfurl(Object.assign({
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
