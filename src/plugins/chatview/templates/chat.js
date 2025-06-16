import { html, nothing } from 'lit';
import { api, constants } from '@converse/headless';
import { __ } from 'i18n';
import { getChatStyle } from 'shared/chat/utils';

const { CHATROOMS_TYPE } = constants;

/**
 * @param {import('../chat').default} el
 */
export default (el) => {
    const help_messages = el.getHelpMessages();
    const show_help_messages = el.model.get('show_help_messages');
    const is_overlayed = api.settings.get('view_mode') === 'overlayed';
    const style = getChatStyle(el.model);
    return html`
        <div class="flyout box-flyout" style="${style || nothing}">
            ${is_overlayed ? html`<converse-dragresize></converse-dragresize>` : ''}
            ${el.model
                ? html`
                      <converse-chat-heading
                          jid="${el.model.get('jid')}"
                          class="chat-head chat-head-chatbox row g-0"
                      ></converse-chat-heading>
                      <div class="chat-body">
                          ${el.model.contact
                              ? html`<converse-contact-approval-alert .contact="${el.model.contact}">
                                </converse-contact-approval-alert>`
                              : ''}
                          <div
                              class="chat-content ${el.model.get('show_send_button') ? 'chat-content-sendbutton' : ''}"
                              aria-live="polite"
                          >
                              <converse-chat-content .model="${el.model}"></converse-chat-content>
                              ${show_help_messages
                                  ? html`<div class="chat-content__help">
                                        <converse-chat-help
                                            .model=${el.model}
                                            .messages=${help_messages}
                                            ?hidden=${!show_help_messages}
                                            type="info"
                                            chat_type="${CHATROOMS_TYPE}"
                                        ></converse-chat-help>
                                    </div>`
                                  : ''}
                          </div>
                          <converse-chat-bottom-panel .model="${el.model}" class="bottom-panel">
                          </converse-chat-bottom-panel>
                      </div>
                  `
                : ''}
        </div>
    `;
};
