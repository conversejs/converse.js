import 'shared/autocomplete/index.js';
import BaseModal from "plugins/modal/base.js";
import tpl_muc_invite_modal from "./templates/muc-invite.js";
import { _converse, converse } from "@converse/headless/core";

const u = converse.env.utils;


export default BaseModal.extend({
    id: "muc-invite-modal",

    initialize () {
        BaseModal.prototype.initialize.apply(this, arguments);
        this.listenTo(this.model, 'change', this.render);
        this.initInviteWidget();
    },

    toHTML () {
        return tpl_muc_invite_modal(Object.assign(
            this.model.toJSON(), {
                'submitInviteForm': ev => this.submitInviteForm(ev)
            })
        );
    },

    initInviteWidget () {
        if (this.invite_auto_complete) {
            this.invite_auto_complete.destroy();
        }
        const list = _converse.roster.map(i => ({'label': i.getDisplayName(), 'value': i.get('jid')}));
        const el = this.el.querySelector('.suggestion-box').parentElement;
        this.invite_auto_complete = new _converse.AutoComplete(el, {
            'min_chars': 1,
            'list': list
        });
    },

    submitInviteForm (ev) {
        ev.preventDefault();
        // TODO: Add support for sending an invite to multiple JIDs
        const data = new FormData(ev.target);
        const jid = data.get('invitee_jids');
        const reason = data.get('reason');
        if (u.isValidJID(jid)) {
            // TODO: Create and use API here
            this.chatroomview.model.directInvite(jid, reason);
            this.modal.hide();
        } else {
            this.model.set({'invalid_invite_jid': true});
        }
    }
});
