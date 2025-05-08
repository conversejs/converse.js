/**
 * @copyright Alfredo Medrano Sánchez and the Converse.js contributors
 * @description
 *  Component inspired by the one from fa-icons
 *  https://github.com/obsidiansoft-io/fa-icons/blob/master/LICENSE
 * @license Mozilla Public License (MPLv2)
 */
import { html } from 'lit';
import { api } from '@converse/headless';
import { CustomElement } from './element.js';

import './styles/icon.scss';


class ConverseIcon extends CustomElement {

    static get properties () {
        return {
            color: { type: String },
            class_name: { attribute: "class" },
            css: { type: String },
            size: { type: String }
        };
    }

    constructor () {
        super();
        this.class_name = "";
        this.css = "";
        this.size = "";
        this.color = "";
    }

    getSource () {
        return `#icon-${this.class_name.trim().split(" ")[1].replace("fa-", "")}`;
    }

    getStyles () {
        const cssprop = this.color.match(/var\((--.*)\)/)?.[1];
        const color = cssprop ? getComputedStyle(this).getPropertyValue(cssprop) : this.color;
        return `
            ${this.size ? `width: ${this.size};` : ''}
            ${this.size ? `height: ${this.size};` : ''}
            ${color ? `fill: ${color};` : ''}
            ${this.css}
        `;
    }

    render () {
        return html`<svg .style="${this.getStyles()}"> <use href="${this.getSource()}"> </use> </svg>`;
    }
}

api.elements.define("converse-icon", ConverseIcon);
