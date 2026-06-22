import { api } from '@converse/headless';
import ConverseWebP from 'shared/webp/index.js';
import ConverseGIFElement from 'shared/gif/component.js';

export default class ConverseWebPElement extends ConverseGIFElement {
    initGIF () {
        this.supergif = new ConverseWebP(this, this.initOPtions());
    }
}

api.elements.define('converse-webp', ConverseWebPElement);
