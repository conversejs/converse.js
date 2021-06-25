import { CustomElement } from './element.js';
import { __ } from 'i18n';
import { api } from "@converse/headless/core";
import { html } from 'lit';
import { renderAvatar } from "shared/directives/avatar.js";

const i18n_profile_picture = __('Your profile picture');


export default class ImagePicker extends CustomElement {

    static get properties () {
        return {
            'height': { type: Number },
            'image': { type: String },
            'width': { type: Number },
        }
    }

    render () {
        const avatar_data = {
            'height': this.height,
            'image': this.image,
            'width': this.width,
        };
        return html`
            <a class="change-avatar" @click=${this.openFileSelection} title="${i18n_profile_picture}">
                ${ renderAvatar(avatar_data) }
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
        reader.onloadend = () => (this.image = reader.result);
        reader.readAsDataURL(file);
    }
}

api.elements.define('converse-image-picker', ImagePicker);
