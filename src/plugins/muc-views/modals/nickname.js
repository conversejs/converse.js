import tpl_nickname from "./templates/nickname.js";
import BaseModal from "plugins/modal/base.js";

export default BaseModal.extend({
    id: 'change-nickname-modal',

    initialize (attrs) {
        this.model = attrs.model;
        BaseModal.prototype.initialize.apply(this, arguments);
    },

    toHTML () {
        return tpl_nickname(this);
    },
});
