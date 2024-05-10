import 'shared/avatar/avatar.js';
import { __ } from 'i18n';
import { converse } from '@converse/headless';
import { html } from 'lit';

const { filesize } = converse.env;

export default (el) => {
    const i18n_uploading = __('Uploading file:');
    const filename = el.model.file.name;
    const size = filesize(el.model.file.size);
    const contact = el.model.occupant || el.model.contact;
    return html`
        <div class="message chat-msg">
            ${ el.shouldShowAvatar() ?
                html`<a class="show-msg-author-modal" @click=${el.showUserModal}>
                    <converse-avatar
                        .model=${contact || el.model}
                        class="avatar align-self-center"
                        name="${el.model.getDisplayName()}"
                        nonce=${el.model.vcard?.get('vcard_updated')}
                        height="40" width="40"></converse-avatar>
                </a>` : '' }
            <div class="chat-msg__content">
                <span class="chat-msg__text">${i18n_uploading} <strong>${filename}</strong>, ${size}</span>
                <progress value="${el.model.get('progress')}"/>
            </div>
        </div>`;
}
