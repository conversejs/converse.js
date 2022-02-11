import '../modtools.js';
import BaseModal from "plugins/modal/base.js";
import tpl_moderator_tools from './templates/moderator-tools.js';

const ModeratorToolsModal = BaseModal.extend({
    id: "converse-modtools-modal",
    persistent: true,

    initialize (attrs) {
        this.jid = attrs.jid;
        this.affiliation = attrs.affiliation;
        BaseModal.prototype.initialize.apply(this, arguments);
    },

    toHTML () {
        return tpl_moderator_tools(this);
    }
});

export default ModeratorToolsModal;
