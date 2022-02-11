import './form.js';
import BaseModal from "plugins/modal/base.js";
import tpl_modal from './templates/modal.js';

const MUCBookmarkFormModal = BaseModal.extend({
    id: "converse-bookmark-modal",

    initialize (attrs) {
        this.jid = attrs.jid;
        this.affiliation = attrs.affiliation;
        BaseModal.prototype.initialize.apply(this, arguments);
    },

    toHTML () {
        return tpl_modal(this);
    }
});

export default MUCBookmarkFormModal;
