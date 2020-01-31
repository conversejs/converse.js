import { html } from "lit-html";
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import { __ } from '@converse/headless/i18n';


const i18n_retry = __('Retry');


export default (o) => html`
    <div class="message chat-info ${o.extra_classes}"
         data-isodate="${o.isodate}"
         data-type="${o.data_name}"
         data-value="${o.data_value}">

        ${ o.render_message ? unsafeHTML(o.message) : o.message }
        ${o.retry ? html`<a class="retry" @click=${o.onRetryClicked}>${i18n_retry}</a>` : ''}
    </div>
`;
