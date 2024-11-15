import { html } from 'lit';
import { Model } from '@converse/skeletor';
import { CustomElement } from './element.js';
import { __ } from 'i18n';
import { api } from "@converse/headless";

const i18n_profile_picture = __('Click to set a new picture');


export default class ImagePicker extends CustomElement {

    constructor () {
        super();
        this.model = null;
        this.width = null;
        this.height = null;
        this.data = new Model();
        this.nonce = null;
    }

    static get properties () {
        return {
            height: { type: Number },
            model: { type: Object },
            width: { type: Number },
        }
    }

    render () {
        return html`
            <a class="change-avatar" @click=${this.openFileSelection} title="${i18n_profile_picture}">
                <converse-avatar
                    .model=${this.model}
                    .pickerdata=${this.data}
                    class="avatar"
                    name="${this.model.getDisplayName()}"
                    height="${this.height}"
                    nonce=${this.nonce || this.model.vcard?.get('vcard_updated')}
                    width="${this.width}"></converse-avatar>
            </a>
            <input @change=${this.updateFilePreview} class="hidden" name="avatar_image" type="file"/>
        `;
    }

    /**
     * @param {Event} ev
     */
    openFileSelection (ev) {
        ev.preventDefault();
        /** @type {HTMLInputElement} */(this.querySelector('input[type="file"]')).click();
    }

    /**
     * @param {InputEvent} ev
     */
    updateFilePreview (ev) {
        const file = /** @type {HTMLInputElement} */(ev.target).files[0];
        const reader = new FileReader();
        reader.onloadend = () => {
            this.data.set({
                'data_uri': reader.result,
                'image_type': file.type
            });
            this.nonce = new Date().toISOString();
            this.requestUpdate();
        }
        reader.readAsDataURL(file);
    }
}

api.elements.define('converse-image-picker', ImagePicker);
