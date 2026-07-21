import { __ } from 'i18n';
import { html } from 'lit';

/**
 * @param {import('../bottom-panel').default} el
 */
export default (el) => {
    const unread_msgs = __('You have unread messages');
    return html`
        ${el.model.ui.get('scrolled') && el.model.get('num_unread')
            ? html`<div
                  class="new-msgs-indicator"
                  @click=${/** @param {MouseEvent} ev */ (ev) => el.viewUnreadMessages(ev)}
              >
                  ▼ ${unread_msgs} ▼
              </div>`
            : ''}
        <converse-reply-preview .model=${el.model}></converse-reply-preview>
        <converse-message-form .model=${el.model}></converse-message-form>
    `;
};
