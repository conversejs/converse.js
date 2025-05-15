import { html } from 'lit';
import { until } from 'lit/directives/until.js';
import { api } from '@converse/headless';
import { __ } from 'i18n';
import { CustomElement } from 'shared/components/element.js';
import tplAvatar from './templates/avatar.js';

import './avatar.scss';

export default class Avatar extends CustomElement {
    static get properties() {
        return {
            model: { type: Object },
            pickerdata: { type: Object },
            name: { type: String },
            width: { type: String },
            height: { type: String },
            nonce: { type: String }, // Used to trigger rerenders
        };
    }

    constructor() {
        super();
        this.model = null;
        this.pickerdata = null;
        this.width = 36;
        this.height = 36;
        this.name = '';
    }

    render() {
        let image_type;
        let image;
        let data_uri;
        if (this.pickerdata) {
            image_type = this.pickerdata.image_type;
            data_uri = this.pickerdata.data_uri;
        } else {
            image_type = this.model?.vcard?.get('image_type');
            image = this.model?.vcard?.get('image');
        }

        if (image_type && (image || data_uri)) {
            return tplAvatar({
                classes: this.getAttribute('class'),
                height: this.height,
                width: this.width,
                image: data_uri || `data:${image_type};base64,${image}`,
                image_type,
                alt_text: __('The profile picture of %1$s', this.name),
            });
        }

        const default_bg_css = `background-color: gray;`;
        const css = `
            width: ${this.width}px;
            height: ${this.height}px;
            font: ${this.width / 2}px Arial;
            line-height: ${this.height}px;`;

        const author_style = this.model.getAvatarStyle(css);
        return html`<div class="avatar-initials" style="${until(author_style, default_bg_css + css)}"
            aria-label="${this.name}">
                ${this.getInitials(this.name)}
        </div>`;
    }

    /**
     * @param {string} name
     * @returns {string}
     */
    getInitials(name) {
        const names = name?.split(' ');
        if (names?.length > 1) {
            return names[0].charAt(0).toUpperCase() + names[names.length - 1].charAt(0).toUpperCase();
        } else if (names?.length === 1) {
            return names[0].charAt(0).toUpperCase();
        }
        return '';
    }
}

api.elements.define('converse-avatar', Avatar);
