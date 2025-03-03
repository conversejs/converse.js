import { svg } from "lit";
import { api } from "@converse/headless";
import { CustomElement } from "shared/components/element.js";
import { QRCodeModel } from "./generator.js";
import { QRErrorCorrectLevelMap } from "./constants.js";

import "./qrcode.scss";

class QRCodeComponent extends CustomElement {
    static get properties() {
        return {
            text: { type: String },
            width: { type: String },
            height: { type: String },
        };
    }

    /** @type {QRCodeModel} */
    #qr_code;

    constructor() {
        super();
        this.#qr_code = null;
        this.text = null;
        this.width = '200px';
        this.height = '200px';
        this.colorDark = "#000000";
        this.colorLight = "#ffffff";
        this.correctLevel = QRErrorCorrectLevelMap.H;
    }

    render() {
        const nCount = this.#qr_code.getModuleCount();
        const rects = [];

        for (let row = 0; row < nCount; row++) {
            for (let col = 0; col < nCount; col++) {
                if (this.#qr_code.isDark(row, col)) {
                    rects.push(svg`<use x="${row}" y="${col}" href="#template"></use>`);
                }
            }
        }

        return svg`
            <svg viewBox="0 0 ${nCount} ${nCount}" width="${this.width}" height="${this.height}" fill="${this.colorLight}">
                <rect fill="${this.colorLight}" width="100%" height="100%"></rect>
                <rect fill="${this.colorDark}" width="1" height="1" id="template"></rect>
                ${rects}
            </svg>
        `;
    }

    /**
     * @param {import("lit").PropertyValues} changedProperties
     */
    shouldUpdate(changedProperties) {
        if (!this.#qr_code || changedProperties.has('text') || changedProperties.has('correctLevel')) {
            this.title = this.text;
            this.#qr_code = new QRCodeModel(this.text, this.correctLevel);
            this.#qr_code.make();
            return super.shouldUpdate(changedProperties) || true;
        }
        return super.shouldUpdate(changedProperties);
    }
}

api.elements.define("converse-qr-code", QRCodeComponent);

export default QRCodeComponent;
