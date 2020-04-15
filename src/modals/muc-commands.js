import { BootstrapModal } from "../converse-modal.js";
import { __ } from '@converse/headless/i18n';
import { api } from "@converse/headless/converse-core";
import tpl_muc_commands_modal from "../templates/muc_commands_modal.js";

const { Strophe } = window.converse.env;


export default BootstrapModal.extend({
    id: "muc-commands-modal",

    initialize () {
        this.commands = [];
        BootstrapModal.prototype.initialize.apply(this, arguments);
        this.listenTo(this.model, 'change', this.render);
        this.getCommands();
    },

    toHTML () {
        return tpl_muc_commands_modal(Object.assign(
            this.model.toJSON(), {
                'display_name': __('Ad-hoc commands for %1$s', this.model.getDisplayName()),
                'commands': this.commands
            })
        );
    },

    async getCommands () {
        this.commands = await api.adhoc.getCommands(Strophe.getDomainFromJid(this.model.get('jid')));
        this.render();
    }
});
