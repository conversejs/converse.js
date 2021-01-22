import UserSettingsModal from "modals/user-settings";
import ViewWithAvatar from 'shared/avatar.js';
import tpl_profile from "./templates/profile.js";
import { __ } from 'i18n';
import { _converse, api } from "@converse/headless/core";


const XMPPStatusView = ViewWithAvatar.extend({
    tagName: "div",
    events: {
        "click a.show-profile": "showProfileModal",
        "click a.change-status": "showStatusChangeModal",
        "click .logout": "logOut"
    },

    initialize () {
        this.listenTo(this.model, "change", this.render);
        this.listenTo(this.model.vcard, "change", this.render);
    },

    toHTML () {
        const chat_status = this.model.get('status') || 'offline';
        return tpl_profile(Object.assign(
            this.model.toJSON(),
            this.model.vcard.toJSON(), {
            chat_status,
            'fullname': this.model.vcard.get('fullname') || _converse.bare_jid,
            "showUserSettingsModal": ev => this.showUserSettingsModal(ev),
            'status_message': this.model.get('status_message') ||
                                __("I am %1$s", this.getPrettyStatus(chat_status)),
        }));
    },

    afterRender () {
        this.renderAvatar();
    },

    showProfileModal (ev) {
        ev.preventDefault();
        api.modal.show(_converse.ProfileModal, {model: this.model}, ev);
    },

    showStatusChangeModal (ev) {
        ev.preventDefault();
        api.modal.show(_converse.ChatStatusModal, {model: this.model}, ev);
    },

    showUserSettingsModal(ev) {
        ev.preventDefault();
        api.modal.show(UserSettingsModal, {model: this.model, _converse}, ev);
    },

    logOut (ev) {
        ev.preventDefault();
        const result = confirm(__("Are you sure you want to log out?"));
        if (result === true) {
            api.user.logout();
        }
    },

    getPrettyStatus (stat) {
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
});

export default XMPPStatusView;
