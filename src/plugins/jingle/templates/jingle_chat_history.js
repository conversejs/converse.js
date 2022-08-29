import '../../../shared/avatar/avatar.js';
import { __ } from 'i18n';
import { html } from "lit";

const ended_call = __('Call Ended');
const pending_call = __('Initiated a call');
const finished_call = __('Finished call');

function calling(el) {
    return html`
    <div class="message separator">
    <div>
            <a class="show-msg-author-modal">
            <converse-avatar
            class="avatar align-self-center"
            height="40" width="40">
            </converse-avatar>
        </a>
    </div>
    <span class="separator-text">${ pending_call} at ${el.get('time')}</span>
    <hr class="separator">
    <span class="separator-text">End Call</span>
    </div>`
}

function finishedCall(o) {
    return html`<div class="message separator"><hr class="separator"><span class="separator-text">${ finished_call } at ${o.time}</span></div>`
}

function retractedCall(o) {
    return html`<div class="message separator"><hr class="separator"><span class="separator-text">${ ended_call } at ${o.time}</span></div>`
}


export default (o) => {
    return html`
    ${(o.get('jingle_status') === 'incoming_call' && o.get('jingle_status') != undefined) ? html`${calling(o)}` : html`
    ${(o.get('jingle_status') === 'retracted' && o.get('jingle_status') != undefined) ? html`${retractedCall(o)}` : html`
    ${ (o.get('jingle_status') === 'call_ended' && o.get('jingle_status') != undefined) ? html`${finishedCall(o)}` : html``}
    `}
    `}
`}
