import BaseModal from "plugins/modal/modal.js";
import tpl_image_modal from "./templates/image.js";
import { __ } from 'i18n';
import { api } from "@converse/headless/core";
import { getFileName } from 'utils/html.js';
import { html } from "lit";

import './styles/image.scss';


export default class ImageModal extends BaseModal {

    renderModal () {
        return tpl_image_modal({ 'src': this.src });
    }

    getModalTitle () {
        return html`${__('Image: ')}<a target="_blank" rel="noopener" href="${this.src}">${getFileName(this.src)}</a>`;
    }
}

api.elements.define('converse-image-modal', ImageModal);
