import BootstrapModal from "./base.js";
import tpl_alert_modal from "./templates/alert.js";
import { __ } from 'i18n';


const Alert = BootstrapModal.extend({
    id: 'alert-modal',

    initialize () {
        BootstrapModal.prototype.initialize.apply(this, arguments);
        this.listenTo(this.model, 'change', this.render)
    },

    toHTML () {
        return tpl_alert_modal(Object.assign({__}, this.model.toJSON()));
    }
});

export default Alert;
