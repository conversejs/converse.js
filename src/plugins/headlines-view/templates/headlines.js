import '../heading.js';
import { html } from 'lit';

/**
 * @param {import('../view').default} el
 */
export default (el) => html`
    <div class="flyout box-flyout">
        <converse-dragresize></converse-dragresize>
        ${el.model
            ? html`<converse-headlines-heading
                      jid="${el.model.get('jid')}"
                      class="chat-head chat-head-chatbox row g-0"
                  >
                  </converse-headlines-heading>
                  <div class="chat-body">
                      <div class="chat-content" aria-live="polite">
                          <converse-chat-content .model=${el.model}></converse-chat-content>
                      </div>
                  </div>`
            : ''}
    </div>
`;
