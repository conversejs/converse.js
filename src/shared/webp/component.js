import { html } from 'lit';
import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import ConverseWebP from 'shared/webp/index.js';

export default class ConverseWebPElement extends CustomElement {
    static get properties () {
        /**
         * @typedef { Object } ConverseWebPComponentProperties
         * @property { String } src
         */
        return {
            'src': { type: String },
        };
    }

    constructor () {
        super();
        this.src = null;
    }

    initWebP () {
        this.superwebp = new ConverseWebP(this);
    }

    /**
     * @param {import('lit').PropertyValues} changed
     */
    updated (changed) {
        if (!this.superwebp || changed.has('src')) {
            this.initWebP();
            return;
        }
    }

    render () {
        return html`<canvas><img src="${this.src}" /></canvas>`;
    }
}

api.elements.define('converse-webp', ConverseWebPElement);
