import { ElementViewWithAvatar } from 'shared/avatar.js';
import UserSettingsModal from "modals/user-settings";
import tpl_profile from "./templates/profile.js";
import { __ } from 'i18n';
import { _converse, api } from "@converse/headless/core";
import { render } from 'lit-html';


function getPrettyStatus (stat) {
    if (stat === 'chat') {
        return __('online');
    } else if (stat === 'dnd') {
        return __('busy');
    } else if (stat === 'xa') {
        return __('away for long');
    } else if (stat === 'away') {
        return __('away');
    } else if (stat === 'offline') {
        return __('offline');
    } else {
        return __(stat) || __('online');
    }
}


class ProfileView extends ElementViewWithAvatar {

    async initialize () {
        this.model = _converse.xmppstatus;
        this.listenTo(this.model, "change", this.render);
        this.listenTo(this.model.vcard, "change", this.render);

        await api.waitUntil('VCardsInitialized');
        this.render();
    }

    render () {
        const chat_status = this.model.get('status') || 'offline';
        render(tpl_profile(Object.assign(
            this.model.toJSON(),
            this.model.vcard.toJSON(), {
            chat_status,
            'fullname': this.model.vcard.get('fullname') || _converse.bare_jid,
            "showUserSettingsModal": ev => this.showUserSettingsModal(ev),
            'status_message': this.model.get('status_message') ||
                                __("I am %1$s", getPrettyStatus(chat_status)),
            'logout': this.logout,
            'showStatusChangeModal': () => this.showStatusChangeModal(),
            'showProfileModal': () => this.showProfileModal()
        })), this);

        this.renderAvatar();
    }

    showProfileModal (ev) {
        ev?.preventDefault();
        api.modal.show(_converse.ProfileModal, {model: this.model}, ev);
    }

    showStatusChangeModal (ev) {
        ev?.preventDefault();
        api.modal.show(_converse.ChatStatusModal, {model: this.model}, ev);
    }

    showUserSettingsModal(ev) {
        ev?.preventDefault();
        api.modal.show(UserSettingsModal, {model: this.model, _converse}, ev);
    }

    logout (ev) { // eslint-disable-line class-methods-use-this
        ev?.preventDefault();
        const result = confirm(__("Are you sure you want to log out?"));
        if (result === true) {
            api.user.logout();
        }
    }
}

api.elements.define('converse-user-profile', ProfileView);
