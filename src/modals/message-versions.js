import { BootstrapModal } from "../converse-modal.js";
import tpl_message_versions_modal from "../templates/message_versions_modal.js";


export default BootstrapModal.extend({
    // FIXME: this isn't globally unique
    id: "message-versions-modal",
    toHTML () {
        return tpl_message_versions_modal(this.model.toJSON());
    }
});
