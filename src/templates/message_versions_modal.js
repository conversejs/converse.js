import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';
import dayjs from 'dayjs';
import { modal_close_button, modal_header_close_button } from "./buttons"


const i18n_message_versions = __('Message versions');


export default (o) => html`
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h4 class="modal-title" id="message-versions-modal-label">${i18n_message_versions}</h4>
                ${modal_header_close_button}
            </div>
            <div class="modal-body">
                <h4>Older versions</h4>
                ${Object.keys(o.older_versions).map(k => html`<p class="older-msg"><time>${dayjs(k).format('MMM D, YYYY, HH:mm:ss')}</time>: ${o.older_versions[k]}</p>`) }
                <hr/>
                <h4>Current version</h4>
                <p>${o.message}</p>
            </div>
            <div class="modal-footer">${modal_close_button}</div>
        </div>
    </div>
`;
