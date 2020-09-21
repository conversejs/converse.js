import { BootstrapModal } from "../converse-modal.js";
import { __ } from '../i18n';
import tpl_chatroom_details_modal from "../templates/chatroom_details_modal.js";


export default BootstrapModal.extend({
    id: "room-details-modal",

    initialize () {
        BootstrapModal.prototype.initialize.apply(this, arguments);
        this.listenTo(this.model, 'change', this.render);
        this.listenTo(this.model.features, 'change', this.render);
        this.listenTo(this.model.occupants, 'add', this.render);
        this.listenTo(this.model.occupants, 'change', this.render);
    },

    toHTML () {
        return tpl_chatroom_details_modal(Object.assign(
            this.model.toJSON(), {
                'config': this.model.config.toJSON(),
                'display_name': __('Groupchat info for %1$s', this.model.getDisplayName()),
                'features': this.model.features.toJSON(),
                'num_occupants': this.model.occupants.length,
            })
        );
    }
});
