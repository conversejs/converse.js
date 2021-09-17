import BootstrapModal from "plugins/modal/base.js";
import tpl_occupant_modal from "./templates/occupant.js";
import { _converse, api } from "@converse/headless/core";


const OccupantModal = BootstrapModal.extend({

    initialize () {
        BootstrapModal.prototype.initialize.apply(this, arguments);
        this.listenTo(this.model, 'change', this.render);
        /**
         * Triggered once the OccupantModal has been initialized
         * @event _converse#userDetailsModalInitialized
         * @type { _converse.ChatBox }
         * @example _converse.api.listen.on('userDetailsModalInitialized', chatbox => { ... });
         */
        api.trigger('occupantModalInitialized', this.model);
    },

    toHTML () {
        return tpl_occupant_modal(Object.assign(
            this.model.toJSON(),
            {
                'avatar_data': this.getAvatarData(),
                'display_name': this.model.getDisplayName()
            }
        ));
    },

    getAvatarData () {
        const vcard = _converse.vcards.findWhere({'jid': this.model.get('jid')});
        const image_type = vcard?.get('image_type') || _converse.DEFAULT_IMAGE_TYPE;
        const image_data = vcard?.get('image') || _converse.DEFAULT_IMAGE;
        const image = "data:" + image_type + ";base64," + image_data;
        return {
            'classes': 'chat-msg__avatar',
            'height': 120,
            'width': 120,
            image,
        };
    }
});

_converse.OccupantModal = OccupantModal;

export default OccupantModal;
