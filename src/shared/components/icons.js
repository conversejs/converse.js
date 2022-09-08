/**
 * @copyright Alfredo Medrano Sánchez and the Converse.js contributors
 * @description
 *  Component inspired by the one from fa-icons
 *  https://github.com/obsidiansoft-io/fa-icons/blob/master/LICENSE
 * @license Mozilla Public License (MPLv2)
 */

import { CustomElement } from './element.js';
import { api } from '@converse/headless/core.js';
import { html } from 'lit';

import './styles/icon.scss';


class ConverseIcon extends CustomElement {

    static get properties () {
        return {
            color: String,
            class_name: { attribute: "class" },
            style: String,
            size: String
        };
    }

    constructor () {
        super();
        this.class_name = "";
        this.style = "";
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
            ${this.style}
        `;
    }

    render () {
        return html`<svg .style="${this.getStyles()}"> <use href="${this.getSource()}"> </use> </svg>`;
    }
}

api.elements.define("converse-icon", ConverseIcon);
