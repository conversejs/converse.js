/**
 * @module icons.js
 * @copyright Alfredo Medrano Sánchez and the Converse.js contributors
 * @description
 *  Component inspired by the one from fa-icons
 *  https://github.com/obsidiansoft-io/fa-icons/blob/master/LICENSE
 * @license Mozilla Public License (MPLv2)
 */

import { html, css } from 'lit-element';
import { CustomElement } from './element.js';


class ConverseIcon extends CustomElement {

    static get properties () {
        return {
            color: String,
            class_name: { attribute: "class" },
            style: String,
            size: String
        };
    }

    static get styles () {
        return css`
            :host {
                display: inline-block;
                padding: 0;
                margin: 0;
            }
        `;
    }

    constructor () {
        super();
        this.class_name = "";
        this.style = "";
        this.size = "";
        this.color = "";
    }

    getSource () {
        return `#icon-${this.class_name.split(" ")[1].replace("fa-", "")}`;
    }

    getStyles () {
        return `
            ${this.size ? `width: ${this.size};` : ''}
            ${this.size ? `height: ${this.size};` : ''}
            ${this.color ? `fill: ${this.color};` : ''}
            ${this.style}
        `;
    }

    render () {
        return html`<svg .style="${this.getStyles()}"> <use href="${this.getSource()}"> </use> </svg>`;
    }
}

customElements.define("converse-icon", ConverseIcon);
