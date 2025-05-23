import { api } from "@converse/headless";
import { __ } from 'i18n/index.js';
import { html } from 'lit';

/**
 * @param {import('../message').default} el
 */
function tplEditedIcon(el) {
    const i18n_edited = __('This message has been edited');
    return html`<converse-icon
        title="${i18n_edited}"
        class="fa fa-edit chat-msg__edit-modal"
        @click=${el.showMessageVersionsModal}
        size="1em"
    ></converse-icon>`;
}

function tplCheckmark() {
    return html`<converse-icon
        size="0.75em"
        color="var(--chat-color)"
        class="fa fa-check chat-msg__receipt"
    ></converse-icon>`;
}

/**
 * @param {import('../message').default} el
 */
export default (el) => {
    const i18n_show = __('Show more');
    const is_groupchat_message = el.model.get('type') === 'groupchat';
    const i18n_show_less = __('Show less');
    const error_text = el.model.get('error_text') || el.model.get('error');
    const i18n_error = `${__('Message delivery failed.')}\n${error_text}`;

    const tplSpoilerHint = html`
        <div class="chat-msg__spoiler-hint">
            <span class="spoiler-hint">${el.model.get('spoiler_hint')}</span>
            <a class="badge badge-info spoiler-toggle" href="#" @click=${el.toggleSpoilerMessage}>
                <converse-icon
                    size="1em"
                    color="var(--background-color)"
                    class="fa ${el.model.get('is_spoiler_visible') ? 'fa-eye-slash' : 'fa-eye'}"
                ></converse-icon>
                ${el.model.get('is_spoiler_visible') ? i18n_show_less : i18n_show}
            </a>
        </div>
    `;

    const spoiler_classes = el.model.get('is_spoiler')
        ? `spoiler ${el.model.get('is_spoiler_visible') ? '' : 'hidden'}`
        : '';
    const text = el.model.getMessageText();
    const show_oob = el.model.get('oob_url') && text !== el.model.get('oob_url');
    const render_media = api.settings.get('render_media');

    return html`
        ${el.model.get('is_spoiler') ? tplSpoilerHint : ''}
        ${el.model.get('subject') ? html`<div class="chat-msg__subject">${el.model.get('subject')}</div>` : ''}
        <span class="chat-msg__body--wrapper ${error_text ? 'error' : ''}">
            <converse-chat-message-body
                class="chat-msg__text ${el.model.get('is_only_emojis')
                    ? 'chat-msg__text--larger'
                    : ''} ${spoiler_classes}"
                .model="${el.model}"
                hide_url_previews=${el.model.get('hide_url_previews')}
                ?is_me_message=${el.model.isMeCommand()}
                text="${text}"
            ></converse-chat-message-body>
            ${el.model.get('received') && !el.model.isMeCommand() && !is_groupchat_message ? tplCheckmark() : ''}
            ${el.model.get('edited') ? tplEditedIcon(el) : ''}
        </span>
        ${show_oob ? html`<div class="chat-msg__media">
            <converse-texture
                text="${el.model.get('oob_url')}"
                .onImgClick="${(ev) => el.onImgClick(ev)}"
                ?embed_audio="${render_media}"
                ?embed_videos="${render_media}"
                ?show_images="${render_media}"
                />
            </div>` : ''}
        ${error_text ? html`<div class="chat-msg__error">${i18n_error}</div>` : ''}
    `;
};
