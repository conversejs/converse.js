import { converse, api, _converse } from '@converse/headless/core';
import JingleCallModal from "./modal/jingle-incoming-call-modal.js";
import tpl_jingle_chat_history from "./templates/jingle_chat_history.js";

const { Strophe, sizzle, $msg } = converse.env;
const u = converse.env.utils;

/**
 * This function merges the incoming attributes and the jingle propose attribute into one.
 * It also determines the type of the media i.e. audio or video
 * @param { XMLElement } stanza
 * @param { Object } attrs
 */
export function parseJingleMessage(stanza, attrs) {
    if(isAJingleMessage(stanza) === true) {
    const jingle_propose_type = getJingleProposeType(stanza);
        return {
            ...attrs, ...{
                'jingle_propose': jingle_propose_type,
                'jingle_retraction_id': getJingleRetractionID(stanza),
                'template_hook': 'getJingleTemplate',
                'jingle_status': jingleStatus(stanza)
            }
        }
    }
}

function isAJingleMessage(stanza) {
    if (jingleStatus(stanza) === 'incoming_call' || jingleStatus(stanza) === 'retracted' || jingleStatus(stanza) === 'call_ended') {
        return true;
    }
    else false;
}

function jingleStatus(stanza) {
    const el_propose = sizzle(`propose[xmlns="${Strophe.NS.JINGLEMESSAGE}"]`, stanza).pop();
    const el_retract = sizzle(`retract[xmlns="${Strophe.NS.JINGLEMESSAGE}"]`, stanza).pop();
    const el_finish = sizzle(`finish[xmlns="${Strophe.NS.JINGLEMESSAGE}"]`, stanza).pop();
    if (el_propose) {
        return 'incoming_call';
    }
    else if (el_retract) {
        return 'retracted';
    }
    else if (el_finish) {
        return 'call_ended';
    }
}

function getJingleProposeType(stanza){
    const el = sizzle(`propose[xmlns="${Strophe.NS.JINGLEMESSAGE}"] > description`, stanza).pop();
    return el?.getAttribute('media');
}

function getJingleRetractionID(stanza){
    const el = sizzle(`propose[xmlns="${Strophe.NS.JINGLEMESSAGE}"]`, stanza).pop();
    return el?.getAttribute('id');
}

export function getJingleTemplate(model) {
    return tpl_jingle_chat_history(model);
}

export function jingleCallInitialized() {
    JingleCallModal;
}

/**
 * This function simply sends the retraction stanza and modifies the attributes
 */
export function retractCall(context) {
    const initiator_message = context.model.messages.where({ template_hook: 'getJingleTemplate', media: 'audio' });
    const propose_id = initiator_message;
    const message_id = u.getUniqueId();
        api.send(
            $msg({
            'from': _converse.bare_jid,
            'to': context.jid,
            'type': 'chat',
            id: message_id
            }).c('retract', {
            'xmlns': Strophe.NS.JINGLEMESSAGE, 'id': propose_id })
            .c('reason', { 'xmlns': Strophe.NS.JINGLE })
            .c('cancel', {}).up()
            .t('Retracted').up().up()
            .c('store', { 'xmlns': Strophe.NS.HINTS })
        );
        const attrs = {
            'from': _converse.bare_jid,
            'to': context.jid,
            'type': 'chat',
            'jingle_retraction_id': propose_id, 
            'msg_id': message_id,
            'template_hook': 'getJingleTemplate'
        }
        context.model.messages.create(attrs);
}

/**
 * This function simply sends the stanza that ends the call
 */
export function finishCall(context) {
    const message_id = u.getUniqueId();
    const stanza = $msg({
        'from': _converse.bare_jid,
        'to': context.jid,
        'type': 'chat'
    }).c('finish', {'xmlns': Strophe.NS.JINGLEMESSAGE, 'id': context.getAttribute('id')})
    .c('reason', {'xmlns': Strophe.NS.JINGLE})  
        .c('success', {}).up()
        .t('Success').up().up()
        .c('store', { 'xmlns': Strophe.NS.HINTS })
        const attrs = {
            'from': _converse.bare_jid,
            'to': context.jid,
            'type': 'chat',
            'msg_id': message_id,
            'jingle_status': context.model.get('jingle_status'),
            'template_hook': 'getJingleTemplate'
        }
        context.model.messages.create(attrs);
    api.send(stanza);
}

/*
 * This is the handler for the 'onMessage' hook
 * It inspects the incoming message attributes and checks whether we have a jingle retraction message
 * if it is, then we find the jingle propose message and update it.
 * @param { _converse.ChatBox } model
 * @param {  } data
 */
export function handleRetraction(model, data) {
    const jingle_retraction_id = data.attrs['jingle_retraction_id'];
    if (jingle_retraction_id) {
        //finding the propose message with the same id as the retraction id
        const message = model.messages.where({ jingle_propose: 'audio' });
        if (message) {
            message.save(data.attrs, { has_been_retracted: 'true' });
            data.handled = true;
        }
    }
    else {
        // It is a dangling retraction; we are waiting for the correct propose message
        model.createMessage(data.attrs);
    }
    return data;
}
