import tpl_profile from './templates/profile.js';
import { CustomElement } from 'shared/components/element.js';
import { _converse, api } from '@converse/headless/core';

class Profile extends CustomElement {
    initialize () {
        this.model = _converse.xmppstatus;
        this.listenTo(this.model, "change", () => this.requestUpdate());
        this.listenTo(this.model, "vcard:add", () => this.requestUpdate());
        this.listenTo(this.model, "vcard:change", () => this.requestUpdate());
    }

    render () {
        return tpl_profile(this);
    }

    showProfileModal (ev) {
        ev?.preventDefault();
        api.modal.show('converse-profile-modal', { model: this.model }, ev);
    }

    showStatusChangeModal (ev) {
        ev?.preventDefault();
        api.modal.show('converse-chat-status-modal', { model: this.model }, ev);
    }

    showUserSettingsModal (ev) {
        ev?.preventDefault();
        api.modal.show('converse-user-settings-modal', { model: this.model, _converse }, ev);
    }
}

api.elements.define('converse-user-profile', Profile);
