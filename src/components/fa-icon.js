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
            :host svg {
                fill: var(--fa-icon-fill-color, currentcolor);
                width: var(--fa-icon-width, 19px);
                height: var(--fa-icon-height, 19px);
            }
        `;
    }

    getSources () {
        const get_prefix = class_name => {
            const data = class_name.split(" ");
            return ['solid', normalizeIconName(data[1])];
        };
        const normalizeIconName = name => {
            const icon = name.replace("fa-", "");
            return icon;
        };
        const data = get_prefix(this.class_name);
        return `#${data[1]}`;
    }

    constructor () {
        super();
        this.class_name = "";
        this.style = "";
        this.size = "";
        this.color = "";
    }

    firstUpdated () {
        this.src = this.getSources();
    }

    _parseStyles () {
        return `
            ${this.size ? `width: ${this.size};` : ''}
            ${this.size ? `height: ${this.size};` : ''}
            ${this.color ? `fill: ${this.color};` : ''}
            ${this.style}
        `;
    }

    render () {
        return html`<svg .style="${this._parseStyles()}"> <use href="${this.src}"> </use> </svg>`;
    }
}

customElements.define("converse-icon", ConverseIcon);
