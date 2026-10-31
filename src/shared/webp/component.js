import { api } from '@converse/headless';
import ConverseGIFElement from 'shared/gif/component.js';
import tplImage from 'shared/texture/templates/image.js';
import ConverseWebP from 'shared/webp/index.js';
import { fetchAnimatedWebP } from 'shared/webp/utils.js';

import './styles.scss';

export default class ConverseWebPElement extends ConverseGIFElement {
    static get properties() {
        return {
            ...super.properties,
            onImgClick: { type: Function },
            onImgLoad: { type: Function },
            img_error: { state: true },
            is_animated: { state: true },
        };
    }

    constructor() {
        super();
        this.onImgClick = null;
        this.onImgLoad = null;
        this.img_error = false;
        this.is_animated = false;
        // Whether we've found out if the image is animated
        this.probed = false;
        /** @type {AbortController} */
        this.probe_controller = null;
        /** @type {ArrayBuffer} */
        this.animation_data = null;
        // The browser couldn't render the image either, so give up and show the fallback.
        // `error` doesn't bubble, hence the capturing listener.
        this.addEventListener('error', () => (this.img_error = true), true);
    }

    connectedCallback() {
        super.connectedCallback();
        // Disconnecting stopped the probe or freed the player, so start over.
        if (this.hasUpdated && !this.probed) this.probe();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        // Free the decoded frames, or stop fetching them. A static image holds none.
        if (this.is_animated || !this.probed) this.reset();
    }

    /**
     * @param {import('lit').PropertyValues} changed
     */
    willUpdate(changed) {
        if (changed.has('src')) {
            this.reset();
            this.img_error = false;
            this.probe();
        }
    }

    reset() {
        this.probe_controller?.abort();
        this.probe_controller = null;
        /** @type {ConverseWebP} */ (this.supergif)?.dispose();
        this.supergif = null;
        this.animation_data = null;
        this.is_animated = false;
        this.probed = false;
    }

    /**
     * Find out whether the image is animated, in which case it's played with
     * a player. Otherwise, it's left to the browser to render.
     */
    async probe() {
        if (!this.src || !globalThis.ImageDecoder) {
            this.probed = true;
            return;
        }

        const controller = new AbortController();
        this.probe_controller = controller;
        let data = null;
        try {
            data = await fetchAnimatedWebP(this.src, controller.signal);
        } catch {
            // E.g. no CORS headers, in which case the browser can still render it.
        }
        // A newer probe or a reset has taken over.
        if (controller.signal.aborted) return;

        this.probe_controller = null;
        this.probed = true;
        this.animation_data = data;
        this.is_animated = !!data;
    }

    initGIF() {
        // There's no canvas to play on unless the image is animated.
        if (!this.animation_data || this.img_error) return;

        const supergif = new ConverseWebP(this, this.getPlayerOptions());
        this.supergif = supergif;
        supergif.handleGIFResponse(this.animation_data);
        this.animation_data = null;
    }

    render() {
        if (this.img_error && ['url', 'empty'].includes(this.fallback)) {
            return this.renderErrorFallback();
        }

        // Static images, and those we can't decode (e.g. no ImageDecoder support
        // or no CORS headers), are left to the browser to render.
        const supergif = /** @type {ConverseWebP} */ (this.supergif);
        if (!this.is_animated || supergif?.load_error || supergif?.is_static) {
            return tplImage({ src: this.src, onClick: this.onImgClick, onLoad: this.onImgLoad });
        }
        return super.render();
    }
}

api.elements.define('converse-webp', ConverseWebPElement);
