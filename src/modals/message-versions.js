import BootstrapModal from "./base.js";
import tpl_message_versions_modal from "./templates/message-versions.js";


export default BootstrapModal.extend({

    toHTML () {
        return tpl_message_versions_modal(this.model.toJSON());
    }
});
