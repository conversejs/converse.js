import { __ } from 'i18n/index.js';
import { getOOBURLMarkup } from 'utils/html.js';
import { html } from 'lit';

const tpl_edited_icon = (el) => {
    const i18n_edited = __('This message has been edited');
    return html`<converse-icon title="${ i18n_edited }" class="fa fa-edit chat-msg__edit-modal" @click=${el.showMessageVersionsModal} size="1em"></converse-icon>`;
}

const tpl_checkmark = () => {
    return html`<converse-icon size="1em" color="var(--chat-color)" class="fa fa-check chat-msg__receipt"></converse-icon>`
}


export default (el) => {
    const i18n_show = __('Show more');
    const is_groupchat_message = (el.model.get('type') === 'groupchat');
    const i18n_show_less = __('Show less');

    const tpl_spoiler_hint = html`
        <div class="chat-msg__spoiler-hint">
            <span class="spoiler-hint">${el.model.get('spoiler_hint')}</span>
            <a class="badge badge-info spoiler-toggle" href="#" @click=${el.toggleSpoilerMessage}>
                <converse-icon size="1em" color="var(--background)" class="fa ${el.model.get('is_spoiler_visible') ? 'fa-eye-slash' : 'fa-eye'}"></converse-icon>
                ${ el.model.get('is_spoiler_visible') ? i18n_show_less : i18n_show }
            </a>
        </div>
    `;

    const spoiler_classes = el.model.get('is_spoiler') ? `spoiler ${el.model.get('is_spoiler_visible') ? '' : 'hidden'}` : '';
    const text = el.model.getMessageText();
    const show_oob = el.model.get('oob_url') && text !== el.model.get('oob_url');

    return html`
        ${ el.model.get('is_spoiler') ? tpl_spoiler_hint : '' }
        ${ el.model.get('subject') ? html`<div class="chat-msg__subject">${el.model.get('subject')}</div>` : '' }
        <span class="chat-msg__body--wrapper">
            <converse-chat-message-body
                class="chat-msg__text ${el.model.get('is_only_emojis') ? 'chat-msg__text--larger' : ''} ${spoiler_classes}"
                .model="${el.model}"
                hide_url_previews=${el.model.get('hide_url_previews')}
                ?is_me_message=${el.model.isMeCommand()}
                text="${text}"></converse-chat-message-body>
            ${ (el.model.get('received') && !el.model.isMeCommand() && !is_groupchat_message) ? tpl_checkmark() : '' }
            ${ (el.model.get('edited')) ? tpl_edited_icon(el) : '' }
        </span>
        ${ show_oob ? html`<div class="chat-msg__media">${getOOBURLMarkup(el.model.get('oob_url'))}</div>` : '' }
        <div class="chat-msg__error">${ el.model.get('error_text') || el.model.get('error') }</div>
    `;
}
