import 'shared/autocomplete/index.js';
import BaseModal from 'plugins/modal/modal.js';
import tplMUCInviteModal from './templates/muc-invite.js';
import { __ } from 'i18n';
import { _converse, api, converse } from '@converse/headless';

const u = converse.env.utils;

export default class MUCInviteModal extends BaseModal {
    constructor (options) {
        super(options);
        this.id = 'converse-modtools-modal';
        this.chatroomview = options.chatroomview;
    }

    initialize () {
        super.initialize();
        this.listenTo(this.model, 'change', () => this.render());
    }

    renderModal () {
        return tplMUCInviteModal(this);
    }

    getModalTitle () {
        return __('Invite someone to this groupchat');
    }

    getAutoCompleteList () {
        return _converse.state.roster.map((i) => ({ 'label': i.getDisplayName(), 'value': i.get('jid') }));
    }

    submitInviteForm (ev) {
        ev.preventDefault();
        // TODO: Add support for sending an invite to multiple JIDs
        const data = new FormData(ev.target);
        const jid = /** @type {string} */ (data.get('invitee_jids'))?.trim();
        const reason = data.get('reason');
        if (u.isValidJID(jid)) {
            // TODO: Create and use API here
            this.chatroomview.model.directInvite(jid, reason);
            this.modal.hide();
        } else {
            this.model.set({ 'invalid_invite_jid': true });
        }
    }
}

api.elements.define('converse-muc-invite-modal', MUCInviteModal);
