import 'shared/autocomplete/index.js';
import BaseModal from "plugins/modal/modal.js";
import tpl_muc_invite_modal from "./templates/muc-invite.js";
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";

const u = converse.env.utils;

export default class MUCInviteModal extends BaseModal {

    initialize () {
        super.initialize();
        this.listenTo(this.model, 'change', () => this.render());
    }

    renderModal () {
        return tpl_muc_invite_modal(this);
    }

    getModalTitle () { // eslint-disable-line class-methods-use-this
        return __('Invite someone to this groupchat');
    }

    getAutoCompleteList () { // eslint-disable-line class-methods-use-this
        return _converse.roster.map(i => ({'label': i.getDisplayName(), 'value': i.get('jid')}));
    }

    submitInviteForm (ev) {
        ev.preventDefault();
        // TODO: Add support for sending an invite to multiple JIDs
        const data = new FormData(ev.target);
        const jid = data.get('invitee_jids')?.trim();
        const reason = data.get('reason');
        if (u.isValidJID(jid)) {
            // TODO: Create and use API here
            this.chatroomview.model.directInvite(jid, reason);
            this.modal.hide();
        } else {
            this.model.set({'invalid_invite_jid': true});
        }
    }
}

api.elements.define('converse-muc-invite-modal', MUCInviteModal);
