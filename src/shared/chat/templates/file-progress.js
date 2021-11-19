import 'shared/avatar/avatar.js';
import filesize from 'filesize';
import { __ } from 'i18n';
import { html } from 'lit';

export default (el) => {
    const i18n_uploading = __('Uploading file:');
    const filename = el.model.file.name;
    const size = filesize(el.model.file.size);
    return html`
        <div class="message chat-msg">
            ${ el.shouldShowAvatar() ?
                html`<a class="show-msg-author-modal" @click=${el.showUserModal}>
                    <converse-avatar class="avatar align-self-center"
                        .data=${el.model.vcard?.attributes}
                        nonce=${el.model.vcard?.get('vcard_updated')}
                        height="40" width="40"></converse-avatar>
                </a>` : '' }
            <div class="chat-msg__content">
                <span class="chat-msg__text">${i18n_uploading} <strong>${filename}</strong>, ${size}</span>
                <progress value="${el.model.get('progress')}"/>
            </div>
        </div>`;
}
