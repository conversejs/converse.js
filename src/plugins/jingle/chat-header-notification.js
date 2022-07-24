import { CustomElement } from 'shared/components/element.js';
import { _converse, api, converse } from "@converse/headless/core";
import tpl_header_button from "./templates/header-button.js";
import { JINGLE_CALL_STATUS } from "./constants.js";

import './styles/jingle.scss';
const { Strophe, $msg } = converse.env;
const u = converse.env.utils;

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
            const initiator_stanza = this.model.messages.findWhere({ 'media': 'audio' });
            const propose_id = initiator_stanza.attributes.propose_id;
            const message_id = u.getUniqueId();
            api.send(
                $msg({
                'from': _converse.bare_jid,
                'to': this.jid,
                'type': 'chat',
                id: message_id
                }).c('retract', { 'xmlns': Strophe.NS.JINGLEMESSAGE, 'id': propose_id })
                .c('reason', { 'xmlns': Strophe.NS.JINGLE })
                .c('cancel', {}).up()
                .t('Retracted').up().up()
                .c('store', { 'xmlns': Strophe.NS.HINTS })
            );
            const attrs = {
                'from': _converse.bare_jid,
                'to': this.jid,
                'type': 'chat',
                'retract_id': propose_id, 
                'msg_id': message_id
            }
            this.model.messages.create(attrs);
            return;
        }
        if ( jingle_status === JINGLE_CALL_STATUS.ACTIVE) {
            this.model.save('jingle_status', JINGLE_CALL_STATUS.ENDED);
            const stanza = $msg({
                'from': _converse.bare_jid,
                'to': this.jid,
                'type': 'chat'
            }).c('finish', {'xmlns': Strophe.NS.JINGLEMESSAGE, 'id': this.getAttribute('id')})
            .c('reason', {'xmlns': Strophe.NS.JINGLE})  
                .c('success', {}).up()
                .t('Success').up().up()
                .c('store', {'xmlns': Strophe.NS.HINTS})
            api.send(stanza);
            return;
        }
    }
}

api.elements.define('converse-call-notification', CallNotification);
