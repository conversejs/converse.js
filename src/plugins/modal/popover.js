import '@popperjs/core';
import { html } from "lit";
import { default as BootstrapPopover } from "bootstrap/js/src/popover.js";
import { api } from "@converse/headless";
import { CustomElement } from "shared/components/element.js";

import './styles/popover.scss';

class Popover extends CustomElement {

    static get properties() {
        return {
            title: { type: String },
            text: { type: String },
        };
    }

    constructor() {
        super();
        this.title = null;
        this.text = null;
    }

    /**
     * @param {import("lit").PropertyValues} changedProperties
     */
    firstUpdated(changedProperties) {
        super.firstUpdated(changedProperties);
        new BootstrapPopover(this.firstElementChild, {
            container: 'converse-root',
            trigger: 'focus',
        });
    }

    render() {
        return html`<button
            type="button"
            class="btn p-0"
            data-toggle="popover"
            data-bs-title="${this.title}"
            data-bs-content="${this.text}"
        >
            <converse-icon class="fa fa-info-circle" size="1.2em"></converse-icon>
        </button>`;
    }
}

api.elements.define("converse-popover", Popover);

export default Popover;
