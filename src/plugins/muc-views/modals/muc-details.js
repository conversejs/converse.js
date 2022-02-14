import BaseModal from "plugins/modal/base.js";
import tpl_muc_details from "./templates/muc-details.js";

import '../styles/muc-details.scss';


export default BaseModal.extend({
    id: "muc-details-modal",

    initialize () {
        BaseModal.prototype.initialize.apply(this, arguments);
        this.listenTo(this.model, 'change', this.render);
        this.listenTo(this.model.features, 'change', this.render);
        this.listenTo(this.model.occupants, 'add', this.render);
        this.listenTo(this.model.occupants, 'change', this.render);
    },

    toHTML () {
        return tpl_muc_details(this.model);
    }
});
