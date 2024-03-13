import tplAddMuc from './templates/add-muc.js';
import BaseModal from 'plugins/modal/modal.js';
import { __ } from 'i18n';
import { _converse, api, converse } from '@converse/headless';

import '../styles/add-muc-modal.scss';

const u = converse.env.utils;
const { Strophe } = converse.env;

export default class AddMUCModal extends BaseModal {
    initialize () {
        super.initialize();
        this.listenTo(this.model, 'change:muc_domain', () => this.render());
        this.muc_roomid_policy_error_msg = null;
        this.render();
        this.addEventListener(
            'shown.bs.modal',
            () => {
                /** @type {HTMLInputElement} */ (this.querySelector('input[name="chatroom"]')).focus();
            },
            false
        );
    }

    renderModal () {
        return tplAddMuc(this);
    }

    getModalTitle () {
        // eslint-disable-line class-methods-use-this
        return __('Enter a new Groupchat');
    }

    parseRoomDataFromEvent (form) {
        // eslint-disable-line class-methods-use-this
        const data = new FormData(form);
        const jid = /** @type {string} */ (data.get('chatroom'))?.trim();
        let nick;
        if (api.settings.get('locked_muc_nickname')) {
            nick = _converse.exports.getDefaultMUCNickname();
            if (!nick) {
                throw new Error('Using locked_muc_nickname but no nickname found!');
            }
        } else {
            nick = /** @type {string} */ (data.get('nickname')).trim();
        }
        return {
            'jid': jid,
            'nick': nick,
        };
    }

    openChatRoom (ev) {
        ev.preventDefault();
        if (this.checkRoomidPolicy()) return;

        const data = this.parseRoomDataFromEvent(ev.target);
        if (data.nick === '') {
            // Make sure defaults apply if no nick is provided.
            data.nick = undefined;
        }
        let jid;
        if (api.settings.get('locked_muc_domain') || (api.settings.get('muc_domain') && !u.isValidJID(data.jid))) {
            jid = `${Strophe.escapeNode(data.jid)}@${api.settings.get('muc_domain')}`;
        } else {
            jid = data.jid;
            this.model.setDomain(jid);
        }

        api.rooms.open(jid, Object.assign(data, { jid }), true);
        ev.target.reset();
        this.modal.hide();
    }

    checkRoomidPolicy () {
        if (api.settings.get('muc_roomid_policy') && api.settings.get('muc_domain')) {
            let jid = /** @type {HTMLInputElement} */ (this.querySelector('converse-autocomplete input')).value;
            if (api.settings.get('locked_muc_domain') || !u.isValidJID(jid)) {
                jid = `${Strophe.escapeNode(jid)}@${api.settings.get('muc_domain')}`;
            }
            const roomid = Strophe.getNodeFromJid(jid);
            const roomdomain = Strophe.getDomainFromJid(jid);
            if (api.settings.get('muc_domain') !== roomdomain || api.settings.get('muc_roomid_policy').test(roomid)) {
                this.muc_roomid_policy_error_msg = null;
            } else {
                this.muc_roomid_policy_error_msg = __('Groupchat id is invalid.');
                return true;
            }
            this.render();
        }
    }
}

api.elements.define('converse-add-muc-modal', AddMUCModal);
