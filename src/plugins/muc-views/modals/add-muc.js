import tpl_add_muc from "../templates/add-muc.js";
import BootstrapModal from "plugins/modal/base.js";
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";

const u = converse.env.utils;
const { Strophe } = converse.env;


export default BootstrapModal.extend({
    persistent: true,
    id: 'add-chatroom-modal',

    events: {
        'submit form.add-chatroom': 'openChatRoom',
        'keyup .roomjid-input': 'checkRoomidPolicy',
        'change .roomjid-input': 'checkRoomidPolicy'
    },

    initialize () {
        BootstrapModal.prototype.initialize.apply(this, arguments);
        this.listenTo(this.model, 'change:muc_domain', this.render);
        this.muc_roomid_policy_error_msg = null;
    },

    toHTML () {
        let placeholder = '';
        if (!api.settings.get('locked_muc_domain')) {
            const muc_domain = this.model.get('muc_domain') || api.settings.get('muc_domain');
            placeholder = muc_domain ? `name@${muc_domain}` : __('name@conference.example.org');
        }
        return tpl_add_muc(Object.assign(this.model.toJSON(), {
            '_converse': _converse,
            'label_room_address': api.settings.get('muc_domain') ? __('Groupchat name') :  __('Groupchat address'),
            'chatroom_placeholder': placeholder,
            'muc_roomid_policy_error_msg': this.muc_roomid_policy_error_msg,
            'muc_roomid_policy_hint': api.settings.get('muc_roomid_policy_hint')
        }));
    },

    afterRender () {
        this.el.addEventListener('shown.bs.modal', () => {
            this.el.querySelector('input[name="chatroom"]').focus();
        }, false);
    },

    parseRoomDataFromEvent (form) {
        const data = new FormData(form);
        const jid = data.get('chatroom');
        let nick;
        if (api.settings.get('locked_muc_nickname')) {
            nick = _converse.getDefaultMUCNickname();
            if (!nick) {
                throw new Error("Using locked_muc_nickname but no nickname found!");
            }
        } else {
            nick = data.get('nickname').trim();
        }
        return {
            'jid': jid,
            'nick': nick
        }
    },

    openChatRoom (ev) {
        ev.preventDefault();
        const data = this.parseRoomDataFromEvent(ev.target);
        if (data.nick === "") {
            // Make sure defaults apply if no nick is provided.
            data.nick = undefined;
        }
        let jid;
        if (api.settings.get('locked_muc_domain') || (api.settings.get('muc_domain') && !u.isValidJID(data.jid))) {
            jid = `${Strophe.escapeNode(data.jid)}@${api.settings.get('muc_domain')}`;
        } else {
            jid = data.jid
            this.model.setDomain(jid);
        }
        api.rooms.open(jid, Object.assign(data, {jid}), true);
        this.modal.hide();
        ev.target.reset();
    },

    checkRoomidPolicy () {
        if (api.settings.get('muc_roomid_policy') && api.settings.get('muc_domain')) {
            let jid = this.el.querySelector('.roomjid-input').value;
            if (api.settings.get('locked_muc_domain') || !u.isValidJID(jid)) {
                jid = `${Strophe.escapeNode(jid)}@${api.settings.get('muc_domain')}`;
            }
            const roomid = Strophe.getNodeFromJid(jid);
            const roomdomain = Strophe.getDomainFromJid(jid);
            if (api.settings.get('muc_domain') !== roomdomain ||
                api.settings.get('muc_roomid_policy').test(roomid)) {
                this.muc_roomid_policy_error_msg = null;
            } else {
                this.muc_roomid_policy_error_msg = __('Groupchat id is invalid.');
            }
            this.render();
        }
    }
});
