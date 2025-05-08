import { html } from 'lit';
import { api } from '@converse/headless';
import { CustomElement } from './element.js';
import { __ } from 'i18n';
import './styles/image-picker.scss';

const i18n_profile_picture = __('Click to set a new picture');
const i18n_clear_picture = __('Clear picture');

export default class ImagePicker extends CustomElement {
    constructor() {
        super();
        this.model = null;
        this.width = null;
        this.height = null;
        this.nonce = null;
    }

    static get properties() {
        return {
            height: { type: Number },
            model: { type: Object },
            width: { type: Number },
        };
    }

    render() {
        return html`
            <div class="image-picker">
                <a class="change-avatar" @click=${this.openFileSelection} title="${i18n_profile_picture}">
                    <converse-avatar
                        .model=${this.model}
                        .pickerdata=${this.data}
                        class="avatar"
                        name="${this.model.getDisplayName()}"
                        height="${this.height}"
                        nonce="${this.nonce || this.model.vcard?.get('vcard_updated')}"
                        width="${this.width}"
                    ></converse-avatar>
                </a>
                ${this.data?.data_uri || this.model?.vcard?.get('image')
                    ? html`<button class="clear-image" @click=${this.clearImage} title="${i18n_clear_picture}">
                          <converse-icon class="fa fa-trash-alt" size="1.5em"></converse-icon>
                      </button>`
                    : ''}
                <input @change=${this.updateFilePreview} class="hidden" name="avatar_image" type="file" />
            </div>
        `;
    }

    /**
     * Clears the selected image.
     * @param {Event} ev
     */
    clearImage(ev) {
        ev.preventDefault();
        const input = /** @type {HTMLInputElement} */(this.querySelector('input[name="avatar_image'));
        input.value = '';
        this.model.vcard.set({
            image: null,
            image_type: null,
        });
        this.data = { data_uri: null, image_type: null };
        this.nonce = new Date().toISOString(); // Update nonce to trigger re-render
        this.requestUpdate();
    }

    /**
     * @param {Event} ev
     */
    openFileSelection(ev) {
        ev.preventDefault();
        /** @type {HTMLInputElement} */ (this.querySelector('input[type="file"]')).click();
    }

    /**
     * @param {InputEvent} ev
     */
    updateFilePreview(ev) {
        const file = /** @type {HTMLInputElement} */ (ev.target).files[0];
        const reader = new FileReader();
        reader.onloadend = () => {
            this.data = {
                data_uri: reader.result,
                image_type: file.type,
            };
            this.nonce = new Date().toISOString();
            this.requestUpdate();
        };
        reader.readAsDataURL(file);
    }
}

api.elements.define('converse-image-picker', ImagePicker);
