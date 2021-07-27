import '../modtools.js';
import BootstrapModal from "modals/base.js";
import tpl_moderator_tools from './templates/moderator-tools.js';

const ModeratorToolsModal = BootstrapModal.extend({
    id: "converse-modtools-modal",
    persistent: true,

    initialize (attrs) {
        this.muc = attrs.muc;
        BootstrapModal.prototype.initialize.apply(this, arguments);
    },

    toHTML () {
        return tpl_moderator_tools(this);
    }
});

export default ModeratorToolsModal;
