import { html } from "lit";
import { api, constants } from '@converse/headless';
import 'shared/chat/help-messages.js';
import 'shared/components/split-resize.js';
import '../bottom-panel.js';
import '../sidebar.js';
import '../muc-chat-content.js';

const { CHATROOMS_TYPE } = constants;

/**
 * @param {import('../chatarea').default} el
 */
export default (el) => {
    const show_send_button = api.settings.get('show_send_button');
    const view_mode = api.settings.get('view_mode');

    let chat_area_classes, sidebar_classes;

    if (view_mode === 'overlayed') {
        chat_area_classes = 'd-none d-md-flex col-s-10 col-md-8';
        sidebar_classes = 'col-xs-12 col-s-2 col-md-4';
    } else {
        chat_area_classes = 'd-none d-md-flex col-md-8 col-xl-10';
        sidebar_classes = 'col-xs-12 col-md-4 col-xl-2';
    }

    return html`
        <div class="chat-area ${el.shouldShowSidebar() ? chat_area_classes : 'col-xs-12' }">
            <div class="chat-content ${show_send_button ? 'chat-content-sendbutton' : ''}" aria-live="polite">
                <converse-muc-chat-content
                    class="chat-content__messages"
                    .model="${el.model}"></converse-muc-chat-content>

                ${(el.model?.get('show_help_messages')) ?
                    html`<div class="chat-content__help">
                        <converse-chat-help
                            .model=${el.model}
                            .messages=${el.getHelpMessages()}
                            type="info"
                            chat_type="${CHATROOMS_TYPE}"
                        ></converse-chat-help></div>` : '' }
            </div>
            <converse-muc-bottom-panel .model=${el.model} class="bottom-panel"></converse-muc-bottom-panel>
        </div>
        ${el.model ? html`
            <converse-split-resize></converse-split-resize>
            <converse-muc-sidebar
                class="${el.shouldShowSidebar() ? sidebar_classes : 'col-xs-0 hidden' }"
                jid=${el.jid}></converse-muc-sidebar>` : '' }`
};
