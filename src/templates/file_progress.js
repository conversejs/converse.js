import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';
import { renderAvatar } from './directives';

const i18n_uploading = __('Uploading file');


export default (o) => html`
    <div class="message chat-msg" data-isodate="${o.time}" data-msgid="${o.msgid}">
        ${ renderAvatar(o) }
        <div class="chat-msg__content">
            <span class="chat-msg__text">${i18n_uploading}:<strong>${o.filename}</strong>, ${o.filesize}</span>
            <progress value="${o.progress}"/>
        </div>
    </div>
`;
