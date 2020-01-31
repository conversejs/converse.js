import { html } from "lit-html";

export default (o) => html`
    <div class="flyout box-flyout">
        <div class="chat-body">
            <div class="chat-content {[ if (o.show_send_button) { ]}chat-content-sendbutton{[ } ]}"
                 @scroll=${o.markScrolled}
                 aria-live="polite"></div>
            <div class="bottom-panel">
                <div class="emoji-picker__container dropup"></div>
                <div class="message-form-container">
            </div>
        </div>
    </div>
`;
