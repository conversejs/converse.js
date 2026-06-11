import BaseModal from "plugins/modal/modal.js";
import tplImageModal from "./templates/image.js";
import { __ } from 'i18n';
import { api } from "@converse/headless";
import { getFileName } from 'utils/html.js';
import { html, nothing } from "lit";

import './styles/image.scss';


export default class ImageModal extends BaseModal {

    /**
     * @param {Record<string, any>} options
     */
    constructor (options) {
        super(options);
        this.src = options.src;
        // The original filename, used as the `download` name when `src` is an
        // opaque `blob:` URL (e.g. a decrypted OMEMO image). See #2632.
        this.filename = options.filename;
    }

    renderModal () {
        return tplImageModal({ 'src': this.src });
    }

    getModalTitle () {
        const filename = this.filename || getFileName(this.src);
        return html`${__('Image: ')}<a
                target="_blank"
                rel="noopener"
                download="${this.filename || nothing}"
                href="${this.src}"
                >${filename}</a
            >`;
    }
}

api.elements.define('converse-image-modal', ImageModal);
