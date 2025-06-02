import { html, nothing } from 'lit';
import { getChatStyle } from 'shared/chat/utils.js';
import '../heading.js';

/**
 * @param {import('../view').default} el
 */
export default (el) => {
    const style = getChatStyle(el.model);
    return html`<div class="flyout box-flyout" style="${style || nothing}">
        <converse-dragresize></converse-dragresize>
        ${el.model
            ? html`<converse-headlines-heading jid="${el.model.get('jid')}" class="chat-head chat-head-chatbox row g-0">
                  </converse-headlines-heading>
                  <div class="chat-body">
                      <div class="chat-content" aria-live="polite">
                          <converse-chat-content .model=${el.model}></converse-chat-content>
                      </div>
                  </div>`
            : ''}
    </div> `;
};
