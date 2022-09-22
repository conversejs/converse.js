import BaseModal from "plugins/modal/modal.js";
import tpl_user_settings_modal from "./templates/user-settings.js";
import { __ } from 'i18n';
import { api } from "@converse/headless/core";

export default class UserSettingsModal extends BaseModal {

    constructor (options) {
        super(options);

        const show_client_info = api.settings.get('show_client_info');
        const allow_adhoc_commands = api.settings.get('allow_adhoc_commands');
        const show_both_tabs = show_client_info && allow_adhoc_commands;

        if (show_both_tabs || show_client_info) {
            this.tab = 'about';
        } else if (allow_adhoc_commands) {
            this.tab = 'commands';
        }
    }

    renderModal () {
        return tpl_user_settings_modal(this);
    }

    getModalTitle () { // eslint-disable-line class-methods-use-this
        return __('Settings');
    }
}

api.elements.define('converse-user-settings-modal', UserSettingsModal);
