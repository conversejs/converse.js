import BootstrapModal from "plugins/modal/base.js";
import tpl_user_settings_modal from "./templates/user-settings.js";

let _converse;

export default BootstrapModal.extend({
    id: "converse-client-info-modal",

    initialize (settings) {
        _converse  = settings._converse;
        BootstrapModal.prototype.initialize.apply(this, arguments);
    },

    toHTML () {
        return tpl_user_settings_modal(
            Object.assign(
                this.model.toJSON(),
                this.model.vcard.toJSON(),
                { 'version_name': _converse.VERSION_NAME }
            )
        );
    }
});
