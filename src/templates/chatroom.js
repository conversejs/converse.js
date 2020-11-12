import { html } from "lit-html";

export default (o) => html`
    <div class="flyout box-flyout">
        <div class="chat-head chat-head-chatroom row no-gutters"></div>
        <div class="chat-body chatroom-body row no-gutters">
            <div class="chat-area col">
                <div class="chat-content ${ o.show_send_button ? 'chat-content-sendbutton' : '' }" aria-live="polite">
                    <div class="chat-content__messages" @scroll=${o.markScrolled}></div>
                    <div class="chat-content__help"></div>
                </div>
                <div class="bottom-panel"></div>
            </div>
            <div class="disconnect-container hidden"></div>
            <converse-muc-sidebar class="occupants col-md-3 col-4 ${o.sidebar_hidden ? 'hidden' : ''}"
                .occupants=${o.occupants}
                .chatroom=${o.model}></converse-muc-sidebar>
        </div>
    </div>
`;
