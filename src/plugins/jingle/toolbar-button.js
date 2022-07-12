import { CustomElement } from 'shared/components/element.js';
import { converse, _converse, api } from "@converse/headless/core";
import { JINGLE_CALL_STATUS } from "./constants.js";
import tpl_toolbar_button from "./templates/toolbar-button.js";

const { Strophe, $msg } = converse.env;

export default class JingleToolbarButton extends CustomElement {

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
        return tpl_toolbar_button(this);
    }

    toggleJingleCallStatus() {
        const jingle_status = this.model.get('jingle_status');
        if ( jingle_status === JINGLE_CALL_STATUS.OUTGOING_PENDING || jingle_status === JINGLE_CALL_STATUS.ACTIVE) {
            this.model.save('jingle_status', JINGLE_CALL_STATUS.ENDED);
            return;
        }
        if (!jingle_status || jingle_status === JINGLE_CALL_STATUS.ENDED) {
            this.model.save('jingle_status', JINGLE_CALL_STATUS.OUTGOING_PENDING);
            api.send(
                $msg({
                    'from': _converse.bare_jid,
                    'to': this.jid,
                    'type': 'chat'
                }).c('propose', {'xmlns': Strophe.NS.JINGLEMESSAGE, 'id': this.getAttribute('id')})
                .c('description', {'xmlns': Strophe.NS.JINGLERTP, 'media': 'audio'}).up().up()
                .c('store', {'xmlns': Strophe.NS.HINTS})
            );
            return;
        }
    }
}

api.elements.define('converse-jingle-toolbar-button', JingleToolbarButton);
