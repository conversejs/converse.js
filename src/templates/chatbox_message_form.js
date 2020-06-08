import { html } from "lit-html";


export default (o) => html`
    <div class="new-msgs-indicator hidden">▼ ${ o.unread_msgs } ▼</div>
    <form class="setNicknameButtonForm hidden">
        <input type="submit" class="btn btn-primary" name="join" value="Join"/>
    </form>
    <form class="sendXMPPMessage">
        <span class="chat-toolbar no-text-select"></span>
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
