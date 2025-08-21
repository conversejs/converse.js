
import { _converse, api, converse } from '@converse/headless';
import BaseModal from 'plugins/modal/modal.js';
import tplAddTodo from './templates/add-todo-modal.js';
import { __ } from 'i18n';

import '../styles/add-muc-modal.scss';

const u = converse.env.utils;
const { Strophe } = converse.env;

export default class AddTodoModal extends BaseModal {
    initialize() {
        super.initialize();
        this.requestUpdate();
        this.addEventListener(
            'shown.bs.modal',
            () => {
                /** @type {HTMLInputElement} */ (this.querySelector('input[name="name"]'))?.focus();
            },
            false
        );
    }

    renderModal() {
        return tplAddTodo(this);
    }

    getModalTitle() {
        return __('Create a new todo list');
    }

    /**
     * @param {HTMLFormElement} form
     * @returns {{ name: string }}
     */
    parseDataFromEvent(form) {
        const data = new FormData(form);
        const name = /** @type {string} */ (data.get('name'))?.trim();
        return { name };
    }

    /**
     * Takes a string and returns a normalized lowercase value representing the node (localpart) of a Todo JID.
     * Replaces all spaces with dashes, replaces diacritics with ASCII, and
     * removes all characters besides letters and numbers and dashes.
     * @param {string} s
     * @returns {string}
     */
    normalizeNode(s) {
        return s
            .trim()
            .replace(/\s+/g, '-')
            .replace(/\u0142/g, 'l')
            .replace(/[^\x00-\x7F]/g, (c) => c.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
            .replace(/[^a-zA-Z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/[^a-zA-Z0-9]$/g, '')
            .toLowerCase();
    }

    /**
     * @param {Event} ev
     */
    async createTodo(ev) {
        ev.preventDefault();

        const form = /** @type {HTMLFormElement} */ (ev.target);

        const data = this.parseDataFromEvent(form);
        const name = data.name;

        api.pubsub.nodes.create(jid, { ...settings, jid }, true);
        form.reset();
        this.modal.hide();
    }

    /**
     * @param {string} jid
     * @return {Promise<string>}
     */
    async validateMUCJID(jid) {
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

        if (!jid.includes('@')) {
            const muc_service = await u.muc.getDefaultMUCService();
            if (!muc_service) {
                return __(
                    "No default groupchat service found. "+
                    "You'll need to specify the full address, for example room@conference.example.org"
                );
            }
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
