import tplProfile from './templates/profile.js';
import { CustomElement } from 'shared/components/element.js';
import { _converse, api } from '@converse/headless/core';

class Profile extends CustomElement {

    static properties = {
        blocked_jids: {},
    }

    initialize () {
        this.model = _converse.xmppstatus;
        this.listenTo(this.model, "change", () => this.requestUpdate());
        this.listenTo(this.model, "vcard:add", () => this.requestUpdate());
        this.listenTo(this.model, "vcard:change", () => this.requestUpdate());
        this.blocked_jids = [];
        this.listenTo(_converse, 'blockListFetched', this.updateBlocked);
        this.listenTo(_converse, 'blockListUpdated', this.updateBlocked);
    }

    render () {
        return tplProfile(this);
    }

    updateBlocked(jid_set) {
        this.blocked_jids = Array.from(jid_set);
        this.requestUpdate();
    }

    showProfileModal (ev) {
        ev?.preventDefault();
        api.modal.show('converse-profile-modal', { model: this.model, blocked_jids: this.blocked_jids }, ev);
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
