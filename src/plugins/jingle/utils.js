import { converse, api, _converse } from '@converse/headless/core';
import JingleCallModal from "./modal/jingle-incoming-call-modal.js";
import { html } from 'lit';

const { Strophe, sizzle, $msg } = converse.env;
const u = converse.env.utils;

/**
 * This function merges the incoming attributes and the jingle propose attribute into one.
 * It also determines the type of the media i.e. audio or video
 * @param { XMLElement } stanza
 * @param { Object } attrs
 */
export function parseJingleMessage(stanza, attrs) {
    if (isAJingleMessage(stanza) === true) {
        const jingle_propose_type = getJingleProposeType(stanza);
        return {
            ...attrs, ...{
                'jingle_propose': jingle_propose_type,
                'jingle_retraction_id': getJingleRetractionId(stanza),
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

function getJingleRetractionId(stanza){
    const el = sizzle(`retract[xmlns="${Strophe.NS.JINGLEMESSAGE}"]`, stanza).pop();
    return el?.getAttribute('id');
}

export function getJingleTemplate(model) {
    return html`<converse-jingle-message jid='${model.get('jingle_status')}'></converse-jingle-message>`;
}

export function jingleCallInitialized() {
    JingleCallModal;
}

/**
 * This function simply sends the retraction stanza and modifies the attributes
 */
export function retractCall(el) {
    const jingle_propose_id = el.model.get('jingle_propose_id');
    const message_id = u.getUniqueId();
        api.send(
            $msg({
            'from': _converse.bare_jid,
            'to': el.jid,
            'type': 'chat',
            id: message_id
            }).c('retract', {
            'xmlns': Strophe.NS.JINGLEMESSAGE, 'id': jingle_propose_id })
            .c('reason', { 'xmlns': Strophe.NS.JINGLE })
            .c('cancel', {}).up()
            .t('Retracted').up().up()
            .c('store', { 'xmlns': Strophe.NS.HINTS })
        );
}

/**
 * This function simply sends the stanza that ends the call
 */
export function finishCall(el) {
    const message_id = u.getUniqueId();
    const finish_id = u.getUniqueId();
    const stanza = $msg({
        'from': _converse.bare_jid,
        'to': el.jid,
        'type': 'chat'
    }).c('finish', {'xmlns': Strophe.NS.JINGLEMESSAGE, 'id': finish_id})
    .c('reason', {'xmlns': Strophe.NS.JINGLE})  
        .c('success', {}).up()
        .t('Success').up().up()
        .c('store', { 'xmlns': Strophe.NS.HINTS })
        const attrs = {
            'from': _converse.bare_jid,
            'to': el.jid,
            'type': 'chat',
            'msg_id': message_id,
            'jingle_status': el.model.get('jingle_status'),
            'template_hook': 'getJingleTemplate'
        }
        el.model.messages.create(attrs);
    api.send(stanza);
}

/*
 * This is the handler for the 'onMessage' hook
 * It inspects the incoming message attributes and checks whether we have a jingle retraction message
 * if it is, then we find the jingle propose message and update it.
 * @param { _converse.ChatBox } model
 * @param {  } data
 */
export async function handleRetraction(model, data) {
    const jingle_retraction_id = data.attrs['jingle_retraction_id'];
    if (jingle_retraction_id) {
        const message = await model.messages.findWhere({ jingle_propose_id: jingle_retraction_id });
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
