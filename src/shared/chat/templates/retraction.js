import { html } from 'lit';
import { __ } from 'i18n';

import '../styles/retraction.scss';

/**
 * @param {import('shared/chat/message').default} el
 * @param {import('lit').TemplateResult|string} [tpl_time] - Kept with the text, before any moderation reason
 */
export default (el, tpl_time = '') => {
    const retraction_text = el.model.isRetracted() ? el.getRetractionText() : null;
    return html`<span class="retraction">
        <span>${retraction_text}</span> ${tpl_time}
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
