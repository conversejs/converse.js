import { _converse, api, converse } from '@converse/headless';
import AutoCompleteComponent from 'shared/autocomplete/component.js';
import tplAddMuc from './templates/add-muc.js';
import BaseModal from 'plugins/modal/modal.js';
import { __ } from 'i18n';

import '../styles/add-muc-modal.scss';

const u = converse.env.utils;
const { Strophe } = converse.env;

export default class AddMUCModal extends BaseModal {
    initialize() {
        super.initialize();
        this.render();
        this.addEventListener(
            'shown.bs.modal',
            () => {
                /** @type {HTMLInputElement} */ (this.querySelector('input[name="chatroom"]')).focus();
            },
            false
        );
    }

    renderModal() {
        return tplAddMuc(this);
    }

    getModalTitle() {
        return __('Enter a new Groupchat');
    }

    /**
     * @param {HTMLFormElement} form
     * @returns {{ jid: string, nick: string }}
     */
    parseRoomDataFromEvent(form) {
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
        return { jid, nick };
    }

    /**
     * Takes a string and returns a normalized lowercase value representing the node (localpart) of a MUC JID.
     * Replaces all spaces with dashes, replaces diacritics with ASCII, and
     * removes all characters besides letters and numbers and dashes.
     * @param {string} s
     * @returns {string}
     */
    normalizeNode(s) {
        return s
            .trim()
            .replace(/\s+/g, '-')
            .replace(/\u0142/g, "l")
            .replace(/[^\x00-\x7F]/g, (c) => c.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
            .replace(/[^a-zA-Z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/[^a-zA-Z0-9]$/g, '')
            .toLowerCase();
    }

    /**
     * @param {Event} ev
     */
    async openChatRoom(ev) {
        ev.preventDefault();

        const autocomplete_el = /** @type {AutoCompleteComponent} */ (this.querySelector('converse-autocomplete'));
        if (autocomplete_el.onChange().error_message) return;

        const { escapeNode, getNodeFromJid, getDomainFromJid } = Strophe;
        const form = /** @type {HTMLFormElement} */ (ev.target);

        const data = this.parseRoomDataFromEvent(form);
        const settings = {
            nick: data.nick ?? undefined,
        };

        let jid;
        if (api.settings.get('locked_muc_domain') || !u.isValidJID(data.jid)) {
            const muc_service = await u.muc.getDefaultMUCService();
            if (muc_service) {
                settings.name = data.jid;
                jid = `${this.normalizeNode(data.jid)}@${muc_service}`.toLowerCase();
            }
        }

        if (!jid) {
            jid = `${escapeNode(getNodeFromJid(data.jid))}@${getDomainFromJid(data.jid)}`.toLowerCase();
        }

        api.rooms.open(jid, { ...settings, jid }, true);
        form.reset();
        this.modal.hide();
    }

    /**
     * @param {string} jid
     * @return {string}
     */
    validateMUCJID(jid) {
        if (jid.length === 0) {
            return __('Invalid groupchat address, it cannot be empty.');
        }

        const num_slashes = jid.split('/').length - 1;
        if (num_slashes > 0) {
            return __('Invalid groupchat address, a forward slash is not allowed.');
        }

        const num_ats = jid.split('@').length - 1;
        if (num_ats > 1) {
            return __('Invalid groupchat address, more than one @ sign is not allowed.');
        }

        if (jid.startsWith('@') || jid.endsWith('@')) {
            return __('Invalid groupchat address, it cannot start or end with an @ sign.');
        }

        const policy = api.settings.get('muc_roomid_policy');
        if (policy && api.settings.get('muc_domain')) {
            if (api.settings.get('locked_muc_domain') || !u.isValidJID(jid)) {
                jid = `${Strophe.escapeNode(jid)}@${api.settings.get('muc_domain')}`;
            }
            const muc_jid = Strophe.getNodeFromJid(jid);
            const muc_domain = Strophe.getDomainFromJid(jid);
            if (api.settings.get('muc_domain') === muc_domain && !policy.test(muc_jid)) {
                return __('Groupchat id is invalid.');
            }
        }
        return '';
    }
}

api.elements.define('converse-add-muc-modal', AddMUCModal);
