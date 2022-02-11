import tpl_muc_nickname_form from './templates/muc-nickname-form.js';
import { CustomElement } from 'shared/components/element';
import { _converse, api } from "@converse/headless/core";

import './styles/nickname-form.scss';


class MUCNicknameForm extends CustomElement {

    static get properties () {
        return {
            'jid': { type: String }
        }
    }

    connectedCallback () {
        super.connectedCallback();
        this.model = _converse.chatboxes.get(this.jid);
    }

    render () {
        return tpl_muc_nickname_form(this);
    }

    submitNickname (ev) {
        ev.preventDefault();
        const nick = ev.target.nick.value.trim();
        if (!nick) {
            return;
        }
        if (this.model.isEntered()) {
            this.model.setNickname(nick);
            this.closeModal();
        } else {
            this.model.join(nick);
        }
    }

    closeModal () {
        const evt = document.createEvent('Event');
        evt.initEvent('hide.bs.modal', true, true);
        this.dispatchEvent(evt);
    }
}

api.elements.define('converse-muc-nickname-form', MUCNicknameForm);

export default MUCNicknameForm;
