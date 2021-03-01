import { CustomElement } from 'components/element.js';
import { _converse, api } from "@converse/headless/core";
import tpl_unfurl from './templates/unfurl.js';


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
        _converse.chatboxviews.get(this.getAttribute('jid'))?.scrollDown();
    }
}

api.elements.define('converse-message-unfurl', MessageUnfurl);
