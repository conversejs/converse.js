import tplMUCNicknameForm from './templates/muc-nickname-form.js';
import { CustomElement } from 'shared/components/element';
import { _converse, api } from "@converse/headless";

import './styles/nickname-form.scss';


class MUCNicknameForm extends CustomElement {

    constructor () {
        super();
        this.jid = null;
    }

    static get properties () {
        return {
            'jid': { type: String }
        }
    }

    connectedCallback () {
        super.connectedCallback();
        const { chatboxes } = _converse.state;
        this.model = chatboxes.get(this.jid);
    }

    render () {
        return tplMUCNicknameForm(this);
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
