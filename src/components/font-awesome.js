import { CustomElement } from './element.js';
import { html } from "lit-element";
import { unsafeSVG } from 'lit-html/directives/unsafe-svg.js';
import { until } from 'lit-html/directives/until.js';


export class FontAwesome extends CustomElement {

    constructor () {
        super();
        const promise = import(/*webpackChunkName: "icons" */ '../../images/icons.svg');
        this.data = promise.then(d => html`${unsafeSVG(d.default())}`);
    }

    render () {  // eslint-disable-line class-methods-use-this
        return html`${until(this.data, '')}`;
    }
}

window.customElements.define('converse-fontawesome', FontAwesome);
