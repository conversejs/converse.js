import { html } from 'lit';
import { __ } from 'i18n';

import '../styles/retraction.scss';

/**
 * @param {import('shared/chat/message').default} el
 */
export default (el) => {
    const retraction_text = el.model.isRetracted() ? el.getRetractionText() : null;
    return html`<span class="retraction">
        <span>${retraction_text}</span>
        ${
            el.model.get('moderation_reason')
                ? html`<q class="chat-msg--retracted__reason">${el.model.get('moderation_reason')}</q>`
                : ''
        }
        ${
            el.model.get('moderation_incomplete')
                ? html`<div class="chat-msg__error">${__('Some versions of this message could not be removed.')}</div>`
                : ''
        }
    </span>`;
};
