import { __ } from 'i18n';
import { api } from "@converse/headless/core";
import { html } from "lit";
import { resetElementHeight } from '../utils.js';


export default (o) => {
    var label_message = o.composing_spoiler ? __('Hidden message') : __('Message');
    if (o.contact_blocked) label_message = __('You blocked this contact.');
    const label_spoiler_hint = __('Optional hint');
    const show_send_button = api.settings.get('show_send_button');

    return html`
        <form class="sendXMPPMessage">
          <fieldset ?disabled=${o.contact_blocked}>
            <input type="text"
                   enterkeyhint="send"
                   placeholder="${label_spoiler_hint || ''}"i
                   value="${o.hint_value || ''}"
                   class="${o.composing_spoiler ? '' : 'hidden'} spoiler-hint"/>
            <textarea
                autofocus
                type="text"
                enterkeyhint="send"
                @drop=${o.onDrop}
                @input=${resetElementHeight}
                @keydown=${o.onKeyDown}
                @keyup=${o.onKeyUp}
                @paste=${o.onPaste}
                @change=${o.onChange}
                class="chat-textarea
                    ${ show_send_button ? 'chat-textarea-send-button' : '' }
                    ${ o.composing_spoiler ? 'spoiler' : '' }"
                placeholder="${label_message}">${ o.message_value || '' }</textarea>
          </fieldset>
        </form>`;
}
