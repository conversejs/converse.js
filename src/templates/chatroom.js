import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';

const i18n_no_history = __('No message history available.');


export default (o) => html`
    <div class="flyout box-flyout">
        <div class="chat-head chat-head-chatroom row no-gutters"></div>
        <div class="chat-body chatroom-body row no-gutters">
            <div class="chat-area col">
                <div class="chat-content ${ o.show_send_button ? 'chat-content-sendbutton' : '' }" aria-live="polite">
                    ${ o.muc_show_logs_before_join ? html`<div class="empty-history-feedback"><span>${ i18n_no_history }</span></div>`  : '' }
                </div>
                <div class="chat-state-notifications"></div>
                <div class="bottom-panel"></div>
            </div>
            <div class="disconnect-container hidden"></div>
        </div>
    </div>
`;
