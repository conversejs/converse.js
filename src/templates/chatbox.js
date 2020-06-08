import { html } from "lit-html";

export default (o) => html`
    <div class="flyout box-flyout">
        <div class="chat-head chat-head-chatbox row no-gutters"></div>
        <div class="chat-body">
            <div class="chat-content ${ o.show_send_button ? 'chat-content-sendbutton' : '' }" aria-live="polite">
                <div class="chat-content__messages" @scroll=${o.markScrolled}></div>
                <div class="chat-content__help"></div>
            </div>
            <div class="bottom-panel">
                <div class="message-form-container">
            </div>
        </div>
    </div>
`;
