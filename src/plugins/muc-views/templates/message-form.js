import { __ } from 'i18n';
import { api } from "@converse/headless/core";
import { html } from "lit";
import { resetElementHeight } from 'plugins/chatview/utils.js';


export default (o) => {
    const label_message = o.composing_spoiler ? __('Hidden message') : __('Message');
    const label_spoiler_hint = __('Optional hint');
    const show_send_button = api.settings.get('show_send_button');
    return html`
        <form class="setNicknameButtonForm hidden">
            <input type="submit" class="btn btn-primary" name="join" value="Join"/>
        </form>
        <form class="sendXMPPMessage">
            <input type="text" placeholder="${label_spoiler_hint || ''}" value="${o.hint_value || ''}" class="${o.composing_spoiler ? '' : 'hidden'} spoiler-hint"/>
            <div class="suggestion-box">
                <ul class="suggestion-box__results suggestion-box__results--above" hidden=""></ul>
                <textarea
                    autofocus
                    type="text"
                    @drop=${o.onDrop}
                    @input=${resetElementHeight}
                    @keydown=${o.onKeyDown}
                    @keyup=${o.onKeyUp}
                    @paste=${o.onPaste}
                    @change=${o.onChange}
                    class="chat-textarea suggestion-box__input
                        ${ show_send_button ? 'chat-textarea-send-button' : '' }
                        ${ o.composing_spoiler ? 'spoiler' : '' }"
                    placeholder="${label_message}">${ o.message_value || '' }</textarea>
                <span class="suggestion-box__additions visually-hidden" role="status" aria-live="assertive" aria-relevant="additions"></span>
            </div>
        </form>`;
}
