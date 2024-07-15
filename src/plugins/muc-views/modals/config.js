/**
 * @typedef {import('@converse/headless/types/plugins/vcard/api').VCardData} VCardData
 */
import tplMUCConfigForm from './templates/muc-config.js';
import BaseModal from 'plugins/modal/modal.js';
import { __ } from 'i18n';
import { api, converse, log } from '@converse/headless';
import { compressImage, isImageWithAlphaChannel } from 'utils/file.js';

const { sizzle } = converse.env;
const u = converse.env.utils;

export default class MUCConfigModal extends BaseModal {

    constructor (options) {
        super(options);
        this.id = 'converse-muc-config-modal';
    }

    initialize () {
        super.initialize();
        this.listenTo(this.model, 'change', () => this.render());
        this.listenTo(this.model.features, 'change:passwordprotected', () => this.render());
        this.listenTo(this.model.session, 'change:config_stanza', () => this.render());
    }

    renderModal () {
        return tplMUCConfigForm(this);
    }

    connectedCallback () {
        super.connectedCallback();
        this.getConfig();
    }

    getModalTitle () {
        return __('Configure %1$s', this.model.getDisplayName());
    }

    async getConfig () {
        const iq = await this.model.fetchRoomConfiguration();
        this.model.session.set('config_stanza', iq.outerHTML);
    }

    /**
     * @param {SubmitEvent} ev
     */
    async setAvatar (ev) {
        const form_data = new FormData(/** @type {HTMLFormElement} */ (ev.target));
        const image_file = /** @type {File} */ (form_data.get('avatar_image'));

        if (image_file?.size) {
            const image_data = isImageWithAlphaChannel ? image_file : await compressImage(image_file);
            const reader = new FileReader();
            reader.onloadend = async () => {
                const vcard_data = /** @type {VCardData} */ ({
                    image: btoa(/** @type {string} */ (reader.result)),
                    image_type: image_file.type,
                });
                await api.vcard.set(this.model.get('jid'), vcard_data);
            };
            reader.readAsBinaryString(image_data);
        }
    }

    /**
     * @param {SubmitEvent} ev
     */
    async submitConfigForm (ev) {
        ev.preventDefault();
        const inputs = sizzle(
            ':input:not([type=button]):not([type=submit]):not([name="avatar_image"][type="file"])',
            ev.target
        );
        const config_array = inputs.map(u.webForm2xForm).filter((f) => f);

        try {
            await this.model.sendConfiguration(config_array);
        } catch (e) {
            log.error(e);
            const message =
                __("Sorry, an error occurred while trying to submit the config form.") + " " +
                __("Check your browser's developer console for details.");
            api.alert('error', __('Error'), message);
        }

        try {
            await this.setAvatar(ev);
        } catch (err) {
            log.fatal(err);
            this.alert([
                __("Sorry, an error happened while trying to save the MUC avatar."),
                __("You can check your browser's developer console for any error output.")
            ].join(" "));
            return;
        }

        await this.model.refreshDiscoInfo();
        this.modal.hide();
    }
}

api.elements.define('converse-muc-config-modal', MUCConfigModal);
