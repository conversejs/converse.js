import { CustomElement } from './element.js';
import { __ } from 'i18n';
import { api } from "@converse/headless/core";
import { html } from 'lit';

const i18n_profile_picture = __('Your profile picture');


export default class ImagePicker extends CustomElement {

    static get properties () {
        return {
            'height': { type: Number },
            'data': { type: Object},
            'width': { type: Number },
        }
    }

    render () {
        return html`
            <a class="change-avatar" @click=${this.openFileSelection} title="${i18n_profile_picture}">
                <converse-avatar class="avatar" .data=${this.data} height="${this.height}" width="${this.width}"></converse-avatar>
            </a>
            <input @change=${this.updateFilePreview} class="hidden" name="image" type="file"/>
        `;
    }

    openFileSelection (ev) {
        ev.preventDefault();
        this.querySelector('input[type="file"]').click();
    }

    updateFilePreview (ev) {
        const file = ev.target.files[0];
        const reader = new FileReader();
        reader.onloadend = () => {
            this.data = {
                'data_uri': reader.result,
                'image_type': file.type
            }
        }
        reader.readAsDataURL(file);
    }
}

api.elements.define('converse-image-picker', ImagePicker);
