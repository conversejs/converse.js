import { CustomElement } from 'shared/components/element.js';
import { _converse, api } from "@converse/headless/core";
import { JINGLE_CALL_STATUS } from "./constants.js";
import tpl_header_button from "./templates/header-button.js";

export default class ChatHeaderCallNotification extends CustomElement {
    
    initialize() {
        this.model = _converse.chatboxes.get(this.jid);
        this.listenTo(this.model, 'change:jingle_status', this.requestUpdate);
    }
    
    render() {
        return tpl_header_button(this);
    }

    toggleJingleCallStatus() {
        const jingle_status = this.model.get('jingle_status');
        if ( jingle_status === JINGLE_CALL_STATUS.PENDING || jingle_status === JINGLE_CALL_STATUS.ACTIVE) {
            this.model.save('jingle_status', JINGLE_CALL_STATUS.ENDED);
            return;
        }
        if (!jingle_status || jingle_status === JINGLE_CALL_STATUS.ENDED) {
            this.model.save('jingle_status', JINGLE_CALL_STATUS.PENDING);
            return;
        }
    }
}

api.elements.define('converse-chat-header-call-notification', ChatHeaderCallNotification);
