import UserSettingsModal from 'modals/user-settings';
import tpl_profile from './templates/profile.js';
import { CustomElement } from 'shared/components/element.js';
import { _converse, api } from '@converse/headless/core';

class Profile extends CustomElement {

    initialize () {
        this.model = _converse.xmppstatus;
        this.listenTo(this.model, "change", this.requestUpdate);
        this.listenTo(this.model, "vcard:add", this.requestUpdate);
        this.listenTo(this.model, "vcard:change", this.requestUpdate);
    }

    render () {
        return tpl_profile(this);
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
}

api.elements.define('converse-user-profile', Profile);
