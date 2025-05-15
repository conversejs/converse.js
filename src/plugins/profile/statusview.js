import { _converse, api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplProfile from './templates/profile.js';

import './styles/profile.scss';


class Profile extends CustomElement {
    initialize () {
        this.model = _converse.state.profile;
        this.listenTo(this.model, "change", () => this.requestUpdate());
        this.listenTo(this.model, "vcard:add", () => this.requestUpdate());
        this.listenTo(this.model, "vcard:change", () => this.requestUpdate());
    }

    render () {
        return tplProfile(this);
    }

    /**
     * @param {MouseEvent} ev
     */
    showProfileModal (ev) {
        ev?.preventDefault();
        api.modal.show('converse-profile-modal', { model: this.model }, ev);
    }

    /**
     * @param {MouseEvent} ev
     */
    showStatusChangeModal (ev) {
        ev?.preventDefault();
        api.modal.show('converse-chat-status-modal', { model: this.model }, ev);
    }
}

api.elements.define('converse-user-profile', Profile);

export default Profile;
