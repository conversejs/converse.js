import BootstrapModal from "plugins/modal/base.js";
import tpl_incoming_call from "../templates/incoming-call.js";

export default BootstrapModal.extend({
    id: "start-jingle-call-modal",
    persistent: true,

    initialize () {
        this.items = [];
        this.loading_items = false;

        BootstrapModal.prototype.initialize.apply(this, arguments);
    },

    toHTML () {
        return tpl_incoming_call();
    }
});
