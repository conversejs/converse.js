import 'shared/avatar/avatar.js';
import 'shared/chat/unfurl.js';
import { __ } from 'i18n';
import { html } from 'lit';
import { api, converse } from '@converse/headless';
import { shouldRenderMediaFromURL } from '../../../utils/url.js';
import { getAuthorStyle } from '../../../utils/color.js';
import { getHats } from '../utils.js';

const { dayjs } = converse.env;

/**
 * @param {import('../message').default} el
 */
export default (el) => {
    const i18n_new_messages = __('New messages');

    const sender = el.model.get('sender');
    const msgid = el.model.get('msgid');
    const edited = el.model.get('edited');
    const time = el.model.get('time');
    const contact = el.model.occupant || el.model.contact;
    const author_style = getAuthorStyle(contact);
    const is_me_message = el.model.isMeCommand();
    const is_followup = el.model.isFollowup();
    const format = api.settings.get('time_format');
    const pretty_time = dayjs(edited || time).format(format);
    const hats = getHats(el.model);
    const is_first_unread = el.model_with_messages.get('first_unread_id') === el.model.get('id');
    const is_retracted = el.isRetracted();
    const username = el.model.getDisplayName();
    const should_show_avatar = el.shouldShowAvatar();

    // The model to use for the avatar.
    // Note: it can happen that the contact has not the vcard attribute but the message has.
    const avatar_model = contact?.vcard ? contact : el.model;

    return html` ${is_first_unread
            ? html`<div class="message separator">
                  <hr class="separator" />
                  <span class="separator-text">${i18n_new_messages}</span>
              </div>`
            : ''}
        <div
            class="message chat-msg ${el.getExtraMessageClasses()}"
            data-isodate="${time}"
            data-msgid="${msgid}"
            data-from="${el.model.get('from')}"
            data-encrypted="${el.model.get('is_encrypted')}"
        >
            <!-- Anchor to allow us to scroll the message into view -->
            <a id="${msgid}"></a>

            ${should_show_avatar && !is_followup
                ? html`<a class="show-msg-author-modal" @click=${el.showUserModal}>
                      <converse-avatar
                          .model=${avatar_model}
                          class="avatar align-self-center"
                          name="${el.model.getDisplayName()}"
                          nonce="${avatar_model.vcard?.get('vcard_updated')}"
                          height="40"
                          width="40"
                      ></converse-avatar>
                  </a>`
                : ''}

            <div
                class="chat-msg__content chat-msg__content--${sender} ${is_me_message
                    ? 'chat-msg__content--action'
                    : ''}"
            >
                ${!is_me_message && !is_followup
                    ? html` <span class="chat-msg__heading">
                          <span class="chat-msg__author">
                              <a class="show-msg-author-modal" @click=${el.showUserModal} style="${author_style}"
                                  >${username}</a
                              >
                          </span>
                          ${hats.map((h) => html`<span class="badge badge-secondary">${h.title}</span>`)}
                          <time timestamp="${edited || time}" class="chat-msg__time">${pretty_time}</time>
                          ${el.model.get('is_encrypted')
                              ? html`<converse-icon class="fa fa-lock" size="1.1em"></converse-icon>`
                              : ''}
                      </span>`
                    : ''}

                <div
                    class="chat-msg__body chat-msg__body--${el.model.get('message_type')} ${el.model.get('received')
                        ? 'chat-msg__body--received'
                        : ''} ${el.model.get('is_delayed') ? 'chat-msg__body--delayed' : ''}"
                >
                    <div class="chat-msg__message">
                        ${is_me_message
                            ? html` <time timestamp="${edited || time}" class="chat-msg__time">${pretty_time}</time
                                  >&nbsp;
                                  <span class="chat-msg__author" style="${author_style}"
                                      >${is_me_message ? '**' : ''}${username}</span
                                  >&nbsp;`
                            : ''}
                        ${is_retracted ? el.renderRetraction() : el.renderMessageText()}
                    </div>
                    <converse-message-actions
                        .model=${el.model}
                        ?is_retracted=${is_retracted}
                    ></converse-message-actions>
                </div>

                ${el.model.get('ogp_metadata')?.map((m) => {
                    if (el.model.get('hide_url_previews') === true) {
                        return '';
                    }
                    if (!shouldRenderMediaFromURL(m['og:image'], 'image')) {
                        return '';
                    }
                    return html`<converse-message-unfurl
                        @animationend="${el.onUnfurlAnimationEnd}"
                        class="${el.model.get('url_preview_transition')}"
                        jid="${el.model_with_messages?.get('jid')}"
                        description="${m['og:description'] || ''}"
                        title="${m['og:title'] || ''}"
                        image="${m['og:image'] || ''}"
                        url="${m['og:url'] || ''}"
                    ></converse-message-unfurl>`;
                })}
            </div>
        </div>`;
};
