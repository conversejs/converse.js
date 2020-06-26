import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';

const i18n_send_message = __('Send the message');


export default (o) => html`
    <div class="new-msgs-indicator hidden">▼ ${ o.unread_msgs } ▼</div>
    <form class="setNicknameButtonForm hidden">
        <input type="submit" class="btn btn-primary" name="join" value="Join"/>
    </form>
    <form class="sendXMPPMessage">
        ${ (o.show_toolbar || o.show_send_button) ? html`
            <div class="chat-toolbar--container">
                ${ o.show_toolbar ? html`<ul class="chat-toolbar no-text-select"></ul>` : '' }
                ${ o.show_send_button ? html`<button type="submit" class="btn send-button fa fa-paper-plane" title="${ i18n_send_message }"></button>` : '' }
            </div>` : ''
        }
        <input type="text" placeholder="${o.label_spoiler_hint || ''}" value="${o.hint_value || ''}" class="${o.composing_spoiler ? '' : 'hidden'} spoiler-hint"/>

        <div class="suggestion-box">
            <ul class="suggestion-box__results suggestion-box__results--above" hidden=""></ul>
            <textarea
                type="text"
                class="chat-textarea suggestion-box__input
                    ${ o.show_send_button ? 'chat-textarea-send-button' : '' }
                    ${ o.composing_spoile ? 'spoiler' : '' }"
                placeholder="${o.label_message}">${ o.message_value || '' }</textarea>
            <span class="suggestion-box__additions visually-hidden" role="status" aria-live="assertive" aria-relevant="additions"></span>
        </div>
    </form>
`;
