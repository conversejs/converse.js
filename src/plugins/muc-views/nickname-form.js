import { _converse, api } from '@converse/headless';
import { CustomElement } from 'shared/components/element';
import tplMUCNicknameForm from './templates/muc-nickname-form.js';

import './styles/nickname-form.scss';

class MUCNicknameForm extends CustomElement {
    constructor() {
        super();
        this.jid = null;
        this.model = null;
    }

    static get properties() {
        return {
            jid: { type: String },
        };
    }

    /**
     * @param {Map<string, any>} changed
     */
    shouldUpdate(changed) {
        if (changed.has('jid') && this.jid) {
            const { chatboxes } = _converse.state;
            this.model = chatboxes.get(this.jid);
        }
        return true;
    }

    render() {
        return tplMUCNicknameForm(this);
    }

    /**
     * @param {Event} ev
     */
    submitNickname(ev) {
        ev.preventDefault();
        const form = /** @type {HTMLFormElement} */ (ev.target);
        const nick = form.nick.value.trim();
        if (!nick) return;

        if (this.model.isEntered()) {
            this.model.setNickname(nick);
            this.closeModal();
        } else {
            this.model.join(nick);
        }
    }

    closeModal() {
        /** @type {import('plugins/modal/modal').default} */ (
            document.querySelector('converse-muc-nickname-modal')
        ).close();
    }
}

api.elements.define('converse-muc-nickname-form', MUCNicknameForm);

export default MUCNicknameForm;
