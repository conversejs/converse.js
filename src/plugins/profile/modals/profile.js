import BaseModal from "plugins/modal/modal.js";
import log from "@converse/headless/log";
import tpl_profile_modal from "../templates/profile_modal.js";
import Compress from 'client-compress';
import { __ } from 'i18n';
import { _converse, api } from "@converse/headless/core";

const compress = new Compress({
    targetSize: 0.1,
    quality: 0.75,
    maxWidth: 256,
    maxHeight: 256
});

export default class ProfileModal extends BaseModal {

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
         * @type { _converse.XMPPStatus }
         * @example _converse.api.listen.on('profileModalInitialized', status => { ... });
         */
        api.trigger('profileModalInitialized', this.model);
    }

    renderModal () {
        return tpl_profile_modal(this);
    }

    getModalTitle () { // eslint-disable-line class-methods-use-this
        return __('Your Profile');
    }

    async setVCard (data) {
        try {
            await api.vcard.set(_converse.bare_jid, data);
        } catch (err) {
            log.fatal(err);
            this.alert([
                __("Sorry, an error happened while trying to save your profile data."),
                __("You can check your browser's developer console for any error output.")
            ].join(" "));
            return;
        }
        this.modal.hide();
    }

    onFormSubmitted (ev) {
        ev.preventDefault();
        const reader = new FileReader();
        const form_data = new FormData(ev.target);
        const image_file = form_data.get('image');
        const data = {
            'fn': form_data.get('fn'),
            'nickname': form_data.get('nickname'),
            'role': form_data.get('role'),
            'email': form_data.get('email'),
            'url': form_data.get('url'),
        };
        if (!image_file.size) {
            Object.assign(data, {
                'image': this.model.vcard.get('image'),
                'image_type': this.model.vcard.get('image_type')
            });
            this.setVCard(data);
        } else {
            const files = [image_file];
            compress.compress(files).then((conversions) => {
                const { photo, } = conversions[0];
                reader.onloadend = () => {
                    Object.assign(data, {
                        'image': btoa(reader.result),
                        'image_type': image_file.type
                    });
                    this.setVCard(data);
                };
                reader.readAsBinaryString(photo.data);
            });
        }
    }
}

api.elements.define('converse-profile-modal', ProfileModal);
