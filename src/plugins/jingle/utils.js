import { converse } from '@converse/headless/core';
import  JingleCallModal from "./modal/jingle-incoming-call-modal.js";

const { Strophe, sizzle } = converse.env;

export function parseJingleMessage(stanza, attrs) {
    return { ...attrs, ...{ 'jingle_propose': getJingleProposeType(stanza) }}
}

function getJingleProposeType(stanza){
    const el = sizzle(`propose[xmlns="${Strophe.NS.JINGLEMESSAGE}"] > description`, stanza).pop();
    return el?.getAttribute('media');
}

export function jingleCallInitialized() {
    JingleCallModal;
}
