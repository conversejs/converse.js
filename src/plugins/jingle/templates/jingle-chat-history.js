import '../../../shared/avatar/avatar.js';
import { __ } from 'i18n';
import { html } from "lit";

// const ended_call = __('Call Ended');
const pending_call = __('Initiated a call with');
// const finished_call = __('Finished call');

function calling(el) {
    const i18n_end_call = __('End Call');
    return html`
    <div class="message separator">
    <hr class="separator">
        <span class="separator-text">
            ${pending_call} 
            <a class="show-msg-author-modal">
                <converse-avatar
                    class="avatar align-self-center"
                    height="40" width="40">
                </converse-avatar>
            </a>
            <a>
            <button class="end-call" @click=${el.endCall} title="${i18n_end_call}">
                End Call
            </button>
            </a>
        </span>
    </div>`
}

// function finishedCall() {
//     return html`<div class="message separator">
//     <a class="show-msg-author-modal">
//         <converse-avatar
//         class="avatar align-self-center"
//         height="40" width="40">
//         </converse-avatar>
//     </a>
//     <span>${finishedCall}</span>
// </div>`
// }

// function retractedCall() {
//     return html`<div class="message separator">
//     <a class="show-msg-author-modal">
//         <converse-avatar
//         class="avatar align-self-center"
//         height="40" width="40">
//         </converse-avatar>
//     </a>
//     <span>${ended_call}</span>
// </div>`
// }


export default (el) => {
    return calling(el);
}
