import { html } from 'lit';

import '../styles/retraction.scss';

export default (el) => {
    const retraction_text = el.isRetracted() ? el.getRetractionText() : null;
    return html`
        <div class="retraction">${retraction_text}</div>
        ${ el.model.get('moderation_reason') ?
                html`<q class="chat-msg--retracted__reason">${el.model.get('moderation_reason')}</q>` : '' }`;
}
