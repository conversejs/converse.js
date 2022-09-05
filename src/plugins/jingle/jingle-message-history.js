import { CustomElement } from 'shared/components/element.js';
import { _converse, api } from "@converse/headless/core";
import tpl_jingle_message_history from "./templates/jingle-chat-history.js";
import { finishCall } from './utils.js';
import { JINGLE_CALL_STATUS } from "./constants.js";

export default class JingleMessageHistory extends CustomElement {

    static properties = {
        'jid': { type: String }
    };

    initialize() {
        this.model = _converse.chatboxes.get(this.jid);
        this.listenTo(this.model, 'change:jingle_status', () => this.requestUpdate());
    }
    
    render() {
        const jid = this.jid;
        return tpl_jingle_message_history(this);
    }
    
    endCall() {
        this.model.save('jingle_status', JINGLE_CALL_STATUS.ENDED);
        finishCall(this);
        return;
    }
}

api.elements.define('converse-jingle-message', JingleMessageHistory);
