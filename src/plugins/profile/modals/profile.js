import { html } from 'lit';
import { Model } from '@converse/skeletor';
import { _converse, api, log } from '@converse/headless';
import { __ } from 'i18n';
import BaseModal from 'plugins/modal/modal.js';
import { compressImage } from 'utils/file.js';
import '../password-reset.js';
import { modal_close_button } from 'plugins/modal/templates/buttons.js';
import tplLogoutButton from '../templates/logout_button.js';
import tplProfileModal from '../templates/profile_modal.js';

import './styles/profile.scss';

export default class ProfileModal extends BaseModal {
    /**
     * @typedef {import('@converse/headless/types/plugins/vcard/types').VCardData} VCardData
     * @typedef {import("@converse/headless").Profile} Profile
     * @typedef {import("lit").TemplateResult} TemplateResult
     */

    static properties = {
        _submitting: { state: true },
        _show_clear_button: { type: Boolean, state: true },
        model: { type: Model },
        tab: { type: String },
    };

    /**
     * @param {Object} options
     */
    constructor(options) {
        super(options);
        this.tab = 'status';
        this._show_clear_button = false;
    }

    initialize() {
        super.initialize();
        this.listenTo(this.model, 'change', this.render);
        this.addEventListener(
            'shown.bs.modal',
            () => {
                /** @type {HTMLInputElement} */ (this.querySelector('input[name="status_message"]'))?.focus();
            },
            false
        );

        /**
         * Triggered when the _converse.ProfileModal has been created and initialized.
         * @event _converse#profileModalInitialized
         * @type {Profile}
         * @example _converse.api.listen.on('profileModalInitialized', status => { ... });
         */
        api.trigger('profileModalInitialized', this.model);
    }

    /**
     * @param {Map<string, boolean>} changed - A map of changed properties.
     */
    willUpdate(changed) {
        if (changed.has('model')) {
            this._show_clear_button = !!this.model.get('status_message');
        }
    }

    getModalTitle() {
        return __('Your Profile');
    }

    /**
     * @returns {TemplateResult}
     */
    renderModal() {
        return tplProfileModal(this);
    }

    /**
     * @returns {TemplateResult}
     */
    renderModalFooter() {
        return html`<div class="modal-footer d-flex justify-content-between">
            ${modal_close_button} ${tplLogoutButton(this)}
        </div>`;
    }

    /**
     * @param {VCardData} data
     */
    async setVCard(data) {
        const bare_jid = _converse.session.get('bare_jid');
        try {
            await api.vcard.set(bare_jid, data);
        } catch (err) {
            log.fatal(err);
            this.alert(
                [
                    __('Sorry, an error happened while trying to save your profile data.'),
                    __("You can check your browser's developer console for any error output."),
                ].join(' ')
            );
            return false;
        }
        return true;
    }

    /**
     * @param {SubmitEvent} ev
     */
    async onProfileFormSubmitted(ev) {
        ev.preventDefault();
        this._submitting = true;

        const form_data = new FormData(/** @type {HTMLFormElement} */ (ev.target));
        const image_file = /** @type {File} */ (form_data.get('avatar_image'));

        const data = /** @type {VCardData} */ ({
            fn: form_data.get('fn'),
            nickname: form_data.get('nickname'),
            role: form_data.get('role'),
            email: form_data.get('email'),
            url: form_data.get('url'),
        });

        if (image_file?.size) {
            const image_data = await compressImage(image_file);
            const reader = new FileReader();
            reader.onloadend = async () => {
                Object.assign(data, {
                    image: btoa(/** @type {string} */ (reader.result)),
                    image_type: image_file.type,
                });
                if (await this.setVCard(data)) {
                    this._submitting = false;
                    this.modal.hide();
                }
            };
            reader.readAsBinaryString(image_data);
        } else {
            Object.assign(data, {
                image: this.model.vcard.get('image'),
                image_type: this.model.vcard.get('image_type'),
            });
            if (await this.setVCard(data)) {
                this.modal.hide();
                api.toast.show('vcard-updated', { type: 'success', body: __('Profile updated successfully') });
            }
            this._submitting = false;
        }
    }

    /**
     * @param {SubmitEvent} ev
     */
    onStatusFormSubmitted(ev) {
        ev.preventDefault();
        const data = new FormData(/** @type {HTMLFormElement} */ (ev.target));
        let show, presence;
        const chat_status = data.get('chat_status');
        if (chat_status === 'online') {
            presence = 'online';
        } else {
            show = chat_status;
        }
        this.model.save({
            status_message: data.get('status_message'),
            presence,
            show,
        });
        this.alert(__('Status updated'), 'info');
    }

    /**
     * @param {MouseEvent} ev
     */
    clearStatusMessage(ev) {
        if (ev && ev.preventDefault) {
            ev.preventDefault();
        }
        this._show_clear_button = false;
        const roster_filter = /** @type {HTMLInputElement} */ (this.querySelector('input[name="status_message"]'));
        roster_filter.value = '';
    }

    /**
     * @param {MouseEvent} ev
     */
    async logOut(ev) {
        ev?.preventDefault();
        this.close();
        const result = await api.confirm(__('Confirm'), __('Are you sure you want to log out?'));
        if (result) {
            api.user.logout();
        }
    }
}

api.elements.define('converse-profile-modal', ProfileModal);
