import { html } from "lit-html";

export default (o) => html`
    <div class="flyout box-flyout">
        <div class="chat-head chat-head-chatbox row no-gutters"></div>
        <div class="chat-body">
            <div class="chat-content ${ o.show_send_button ? 'chat-content-sendbutton' : '' }" @scroll=${o.markScrolled} aria-live="polite"></div>
            <div class="chat-state-notifications"></div>
            <div class="bottom-panel">
                <div class="emoji-picker__container dropup"></div>
                <div class="message-form-container">
            </div>
        </div>
    </div>
`;
