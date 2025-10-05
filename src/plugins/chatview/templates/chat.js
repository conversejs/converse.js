import { html, nothing } from 'lit';
import { api, constants } from '@converse/headless';
import { __ } from 'i18n';
import { getChatStyle } from 'shared/chat/utils';

const { CHATROOMS_TYPE } = constants;

export default (el) => {
    const help_messages = el.getHelpMessages();
    const show_help_messages = el.model.get('show_help_messages');
    const is_overlayed = api.settings.get('view_mode') === 'overlayed';
    const style = getChatStyle(el.model);
    const contact_name = el.model.getDisplayName?.() || el.model.get('jid');
    
    return html`
        <div 
            class="flyout box-flyout" 
            style="${style || nothing}"
            role="complementary"
            aria-label="${__('Chat con %1$s', contact_name)}"
        >
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
                              aria-relevant="additions"
                              aria-atomic="false"
                              role="log"
                              aria-label="${__('Historial de mensajes')}"
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
                          <converse-chat-bottom-panel 
                              .model="${el.model}" 
                              class="bottom-panel"
                              role="form"
                              aria-label="${__('Formulario de composición de mensajes')}"
                          >
                          </converse-chat-bottom-panel>
                      </div>
                  `
                : ''}
        </div>
    `;
};
