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
        return tpl_muc_nickname_form(this.model);
    }
}

api.elements.define('converse-muc-nickname-form', MUCNicknameForm);

export default MUCNicknameForm;
