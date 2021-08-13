import { __ } from 'i18n';
import { converse } from  '@converse/headless/core';
import { html } from 'lit';

const { dayjs } = converse.env;

export default (el) => {
    const isodate = dayjs(el.model.get('time')).toISOString();
    const i18n_retry = __('Retry');
    return html`
        <div class="message chat-info chat-${el.model.get('type')}"
            data-isodate="${isodate}"
            data-type="${el.data_name}"
            data-value="${el.data_value}">

            <div class="chat-info__message">
                <converse-rich-text
                    .mentions=${el.model.get('references')}
                    render_styling
                    text=${el.model.getMessageText()}>
                </converse-rich-text>
            </div>
            ${ el.model.get('reason') ? html`<q class="reason">${el.model.get('reason')}</q>` : `` }
            ${ el.model.get('error_text') ? html`<q class="reason">${el.model.get('error_text')}</q>` : `` }
            ${ el.model.get('retry_event_id') ? html`<a class="retry" @click=${el.onRetryClicked}>${i18n_retry}</a>` : '' }
        </div>`;
}
