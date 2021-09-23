import ConverseGif from 'shared/gif/index.js';
import { CustomElement } from 'shared/components/element.js';
import { api } from '@converse/headless/core';
import { getHyperlinkTemplate } from 'utils/html.js';
import { html } from 'lit';

import './styles/gif.scss';

export default class ConverseGIFElement extends CustomElement {
    static get properties () {
        /**
         * @typedef { Object } ConverseGIFComponentProperties
         * @property { Boolean } autoplay
         * @property { Boolean } noloop
         * @property { String } progress_color
         * @property { String } nick
         * @property { ('url'|'empty'|'error') } fallback
         * @property { String } src
         */
        return {
            'autoplay': { type: Boolean },
            'noloop': { type: Boolean },
            'progress_color': { type: String },
            'fallback': { type: String },
            'src': { type: String },
        };
    }

    constructor () {
        super();
        this.autoplay = false;
        this.noloop = false;
        this.fallback = 'url';
    }

    initGIF () {
        const options = {
            'autoplay': this.autoplay,
            'loop': !this.noloop,
        }
        if (this.progress_color) {
            options['progress_color'] = this.progress_color;
        }
        this.supergif = new ConverseGif(this, options);
    }

    updated (changed) {
        if (!this.supergif || changed.has('src')) {
            this.initGIF();
            return;
        }
        if (changed.has('autoplay')) {
            this.supergif.options.autoplay = this.autoplay;
        }
        if (changed.has('noloop')) {
            this.supergif.options.loop = !this.noloop;
        }
        if (changed.has('progress_color')) {
            this.supergif.options.progress_color = this.progress_color;
        }
    }

    render () {
        return (this.supergif?.load_error && ['url', 'empty'].includes(this.fallback)) ? this.renderErrorFallback() :
            html`<canvas class="gif-canvas"
                @mouseover=${() => this.setHover()}
                @mouseleave=${() => this.unsetHover()}
                @click=${ev => this.onControlsClicked(ev)}><img class="gif" src="${this.src}"></a></canvas>`;
    }

    renderErrorFallback () {
        if (this.fallback === 'url') {
            return getHyperlinkTemplate(this.src);
        } else if (this.fallback === 'empty') {
            return '';
        }
    }

    setHover () {
        if (this.supergif) {
            this.supergif.hovering = true;
            this.hover_timeout && clearTimeout(this.hover_timeout);
            this.hover_timeout = setTimeout(() => this.unsetHover(), 2000);
        }
    }

    unsetHover () {
        if (this.supergif) this.supergif.hovering = false;
    }

    onControlsClicked (ev) {
        ev.preventDefault();
        if (this.supergif.playing) {
            this.supergif.pause();
        } else {
            // When the user manually clicks play, we turn on looping
            this.supergif.options.loop = true;
            this.supergif.play();
        }
    }
}

api.elements.define('converse-gif', ConverseGIFElement);
