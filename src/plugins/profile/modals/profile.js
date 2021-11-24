import BootstrapModal from "plugins/modal/base.js";
import bootstrap from "bootstrap.native";
import log from "@converse/headless/log";
import tpl_profile_modal from "../templates/profile_modal.js";
import Compress from 'client-compress';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";

const { sizzle } = converse.env;

const options = {
  targetSize: 0.1,
  quality: 0.75,
  maxWidth: 256,
  maxHeight: 256
}

const compress = new Compress(options)


const ProfileModal = BootstrapModal.extend({
    id: "user-profile-modal",
    events: {
        'submit .profile-form': 'onFormSubmitted'
    },

    initialize () {
        this.listenTo(this.model, 'change', this.render);
        BootstrapModal.prototype.initialize.apply(this, arguments);
        /**
            * Triggered when the _converse.ProfileModal has been created and initialized.
            * @event _converse#profileModalInitialized
            * @type { _converse.XMPPStatus }
            * @example _converse.api.listen.on('profileModalInitialized', status => { ... });
            */
        api.trigger('profileModalInitialized', this.model);
    },

    toHTML () {
        return tpl_profile_modal(Object.assign(
            this.model.toJSON(),
            this.model.vcard.toJSON(),
            { 'view': this }
        ));
    },

    afterRender () {
        this.tabs = sizzle('.nav-item .nav-link', this.el).map(e => new bootstrap.Tab(e));
    },

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
    },

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
});

_converse.ProfileModal = ProfileModal;

export default ProfileModal;
