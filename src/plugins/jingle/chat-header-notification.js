import { CustomElement } from 'shared/components/element.js';
import { _converse, api } from "@converse/headless/core";
import tpl_header_button from "./templates/header-button.js";
import { JINGLE_CALL_STATUS } from "./constants.js";
import { retractCall, finishCall } from './utils.js';


import './styles/jingle.scss';

export default class CallNotification extends CustomElement {
    
    static get properties() {
        return {
            'jid': { type: String },
        }
    }

    initialize() {
        this.model = _converse.chatboxes.get(this.jid);
        this.listenTo(this.model, 'change:jingle_status', () => this.requestUpdate());
    }
    
    render() {
        return tpl_header_button(this);
    }

    endCall() {
        const jingle_status = this.model.get('jingle_status');
        if ( jingle_status === JINGLE_CALL_STATUS.OUTGOING_PENDING ) {
            this.model.save('jingle_status', JINGLE_CALL_STATUS.ENDED);
            retractCall(this);
            return;
        }
        if ( jingle_status === JINGLE_CALL_STATUS.ACTIVE) {
            this.model.save('jingle_status', JINGLE_CALL_STATUS.ENDED);
            finishCall(this);
            return;
        }
    }
}

api.elements.define('converse-call-notification', CallNotification);
