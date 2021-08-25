import { __ } from 'i18n/index.js';
import { api } from  '@converse/headless/core';
import { getOOBURLMarkup } from 'utils/html.js';
import { html } from 'lit';

const tpl_edited_icon = (el) => {
    const i18n_edited = __('This message has been edited');
    return html`<converse-icon title="${ i18n_edited }" class="fa fa-edit chat-msg__edit-modal" @click=${el.showMessageVersionsModal} size="1em"></converse-icon>`;
}


export default (el) => {
    const i18n_show = __('Show more');
    const is_groupchat_message = (el.model.get('type') === 'groupchat');
    const i18n_show_less = __('Show less');

    const tpl_spoiler_hint = html`
        <div class="chat-msg__spoiler-hint">
            <span class="spoiler-hint">${el.model.get('spoiler_hint')}</span>
            <a class="badge badge-info spoiler-toggle" href="#" @click=${el.toggleSpoilerMessage}>
                <i class="fa ${el.model.get('is_spoiler_visible') ? 'fa-eye-slash' : 'fa-eye'}"></i>
                ${ el.model.get('is_spoiler_visible') ? i18n_show_less : i18n_show }
            </a>
        </div>
    `;
    const spoiler_classes = el.model.get('is_spoiler') ? `spoiler ${el.model.get('is_spoiler_visible') ? '' : 'hidden'}` : '';
    const text = el.model.getMessageText();
    return html`
        ${ el.model.get('is_spoiler') ? tpl_spoiler_hint : '' }
        ${ el.model.get('subject') ? html`<div class="chat-msg__subject">${el.model.get('subject')}</div>` : '' }
        <span>
            <converse-chat-message-body
                class="chat-msg__text ${el.model.get('is_only_emojis') ? 'chat-msg__text--larger' : ''} ${spoiler_classes}"
                .model="${el.model}"
                ?hide_url_previews=${el.model.get('hide_url_previews')}
                ?is_me_message=${el.model.isMeCommand()}
                ?show_images=${api.settings.get('show_images_inline')}
                ?embed_videos=${api.settings.get('embed_videos')}
                ?embed_audio=${api.settings.get('embed_audio')}
                text="${text}"></converse-chat-message-body>
            ${ (el.model.get('received') && !el.model.isMeCommand() && !is_groupchat_message) ? html`<span class="fa fa-check chat-msg__receipt"></span>` : '' }
            ${ (el.model.get('edited')) ? tpl_edited_icon(el) : '' }
        </span>
        ${ el.model.get('oob_url') ? html`<div class="chat-msg__media">${getOOBURLMarkup(el.model.get('oob_url'))}</div>` : '' }
        <div class="chat-msg__error">${ el.model.get('error_text') || el.model.get('error') }</div>
    `;
}
