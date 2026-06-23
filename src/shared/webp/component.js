import { api } from '@converse/headless';
import ConverseWebP from 'shared/webp/index.js';
import ConverseGIFElement from 'shared/gif/component.js';

export default class ConverseWebPElement extends ConverseGIFElement {
    initGIF () {
        this.supergif = new ConverseWebP(this, this.initOPtions());
    }

    /** @param {MouseEvent} event */
    onControlsClicked (event) {
        if (this.supergif.frames.length === 1) {
            return;
        }
        super.onControlsClicked(event);
    }
}

api.elements.define('converse-webp', ConverseWebPElement);
