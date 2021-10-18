import BootstrapModal from "plugins/modal/base.js";
import tpl_muc_details from "./templates/muc-details.js";
import { __ } from 'i18n';


export default BootstrapModal.extend({
    id: "muc-details-modal",

    initialize () {
        BootstrapModal.prototype.initialize.apply(this, arguments);
        this.listenTo(this.model, 'change', this.render);
        this.listenTo(this.model.features, 'change', this.render);
        this.listenTo(this.model.occupants, 'add', this.render);
        this.listenTo(this.model.occupants, 'change', this.render);
    },

    toHTML () {
        return tpl_muc_details(Object.assign(
            this.model.toJSON(), {
                'config': this.model.config.toJSON(),
                'display_name': __('Groupchat info for %1$s', this.model.getDisplayName()),
                'features': this.model.features.toJSON(),
                'num_occupants': this.model.occupants.length,
            })
        );
    }
});
