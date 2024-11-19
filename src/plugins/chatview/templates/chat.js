import { html } from "lit";
import { api, constants } from '@converse/headless';

const { CHATROOMS_TYPE } = constants;

export default (o) => html`
    <div class="flyout box-flyout">
        ${ api.settings.get('view_mode') === 'overlayed' ? html`<converse-dragresize></converse-dragresize>` : '' }
        ${ o.model ? html`
            <converse-chat-heading jid="${o.jid}" class="chat-head chat-head-chatbox row g-0"></converse-chat-heading>
            <div class="chat-body">
                <div class="chat-content ${ o.show_send_button ? 'chat-content-sendbutton' : '' }" aria-live="polite">
                    <converse-chat-content
                        class="chat-content__messages"
                        .model="${o.model}"></converse-chat-content>

                    ${o.show_help_messages ? html`<div class="chat-content__help">
                            <converse-chat-help
                                .model=${o.model}
                                .messages=${o.help_messages}
                                ?hidden=${!o.show_help_messages}
                                type="info"
                                chat_type="${CHATROOMS_TYPE}"
                            ></converse-chat-help></div>` : '' }
                </div>
                <converse-chat-bottom-panel jid="${o.jid}" class="bottom-panel"> </converse-chat-bottom-panel>
            </div>
        ` : '' }
    </div>
`;
