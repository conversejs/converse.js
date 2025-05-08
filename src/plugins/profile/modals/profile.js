import { _converse, api, log } from "@converse/headless";
import { compressImage, isImageWithAlphaChannel } from 'utils/file.js';
import BaseModal from "plugins/modal/modal.js";
import { __ } from 'i18n';
import '../password-reset.js';
import tplProfileModal from "../templates/profile_modal.js";

import './styles/profile.scss';


export default class ProfileModal extends BaseModal {
    /**
     * @typedef {import('@converse/headless/types/plugins/vcard/api').VCardData} VCardData
     * @typedef {import("@converse/headless").Profile} Profile
     */

    static properties = {
        _submitting: { state: true }
    }

    /**
     * @param {Object} options
     */
    constructor (options) {
        super(options);
        this.tab = 'profile';
    }

    initialize () {
        super.initialize();
        this.listenTo(this.model, 'change', this.render);
        /**
         * Triggered when the _converse.ProfileModal has been created and initialized.
         * @event _converse#profileModalInitialized
         * @type {Profile}
         * @example _converse.api.listen.on('profileModalInitialized', status => { ... });
         */
        api.trigger('profileModalInitialized', this.model);
    }

    renderModal () {
        return tplProfileModal(this);
    }

    getModalTitle () { // eslint-disable-line class-methods-use-this
        return __('Your Profile');
    }

    /**
     * @param {VCardData} data
     */
    async setVCard (data) {
        const bare_jid = _converse.session.get('bare_jid');
        try {
            await api.vcard.set(bare_jid, data);
        } catch (err) {
            log.fatal(err);
            this.alert([
                __("Sorry, an error happened while trying to save your profile data."),
                __("You can check your browser's developer console for any error output.")
            ].join(" "));
            return false;
        }
        return true;
    }

    /**
     * @param {SubmitEvent} ev
     */
    async onFormSubmitted (ev) {
        ev.preventDefault();
        this._submitting = true;

        const form_data = new FormData(/** @type {HTMLFormElement} */(ev.target));
        const image_file = /** @type {File} */(form_data.get('avatar_image'));

        const data = /** @type {VCardData} */({
            fn: form_data.get('fn'),
            nickname: form_data.get('nickname'),
            role: form_data.get('role'),
            email: form_data.get('email'),
            url: form_data.get('url'),
        });

        if (image_file?.size) {
            const image_data = isImageWithAlphaChannel ? image_file : await compressImage(image_file);
            const reader = new FileReader();
            reader.onloadend = async () => {
                Object.assign(data, {
                    image: btoa(/** @type {string} */(reader.result)),
                    image_type: image_file.type
                });
                if (await this.setVCard(data)) {
                    this.modal.hide();
                }
            };
            reader.readAsBinaryString(image_data);
        } else {
            Object.assign(data, {
                image: this.model.vcard.get('image'),
                image_type: this.model.vcard.get('image_type')
            });
            if (await this.setVCard(data)) {
                this.modal.hide();
                api.toast.show('vcard-updated', { body: __("Profile updated successfully") });
            }
        }
        this._submitting = false;
    }
}

api.elements.define('converse-profile-modal', ProfileModal);
