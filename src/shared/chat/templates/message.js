import { html, nothing } from 'lit';
import { api, converse } from '@converse/headless';
import { shouldRenderMediaFromURL } from '../../../utils/url.js';
import { getAuthorStyle } from '../../../utils/color.js';
import { getHats } from '../utils.js';
import { __ } from 'i18n';
import 'shared/avatar/avatar.js';
import 'shared/chat/unfurl.js';
import 'shared/chat/reply-context.js';

const { dayjs } = converse.env;

/**
 * @param {import('../message').default} el
 */
export default (el) => {
    const i18n_new_messages = __('New messages');

    const edited = el.model.get('edited');
    const is_first_unread = el.model_with_messages.get('first_unread_id') === el.model.get('id');
    const is_followup = el.model.isFollowup();
    const is_me_message = el.model.isMeCommand();
    const is_retracted = el.model.isRetracted();
    const msgid = el.model.get('msgid');
    const sender = el.model.get('sender');
    const time = el.model.get('time');

    const contact = el.model.occupant || el.model.contact;
    const author_style = getAuthorStyle(contact);
    const format = api.settings.get('time_format');

    const dayjs_time = dayjs(edited || time);
    const pretty_time = dayjs_time.format(format);
    const pretty_date = dayjs_time.format('llll');

    const hats = getHats(el.model);
    const username = el.model.getDisplayName();

    const is_action = is_me_message || is_retracted;
    const should_show_header = !is_action && !is_followup;
    const should_show_avatar = el.shouldShowAvatar() && should_show_header;

    // The model to use for the avatar.
    // Note: it can happen that the contact has not the vcard attribute but the message has.
    const avatar_model = contact?.vcard ? contact : el.model;

    return html`${is_first_unread
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

            ${should_show_avatar
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

            <div class="chat-msg__content chat-msg__content--${sender} ${is_action ? 'chat-msg__content--action' : ''}">
                ${should_show_header
                    ? html` <span class="chat-msg__heading">
                          <span class="chat-msg__author">
                              <a class="show-msg-author-modal" @click=${el.showUserModal} style="${author_style}"
                                  >${username}</a
                              >
                          </span>
                          ${hats.map((h) => html`<span class="badge badge-secondary">${h.title}</span>`)}
                          <time title="${pretty_date}" timestamp="${edited || time}" class="chat-msg__time">${pretty_time}</time>
                          ${el.model.get('is_encrypted')
                              ? html`<converse-icon class="fa fa-lock" size="1.1em"></converse-icon>`
                              : ''}
                      </span>`
                    : ''}

                ${el.model.get('reply_to_id') ? html`<converse-reply-context .model=${el.model} .model_with_messages=${el.model_with_messages}></converse-reply-context>` : ''}

                <div
                    class="chat-msg__body chat-msg__body--${el.model.get('message_type')} ${el.model.get('received')
                        ? 'chat-msg__body--received'
                        : ''} ${el.model.get('is_delayed') ? 'chat-msg__body--delayed' : ''}"
                >
                    <div class="chat-msg__message">
                        ${is_action
                            ? html`<time title="${pretty_date}" timestamp="${edited || time}" class="chat-msg__time">${pretty_time}</time>
                                  ${is_me_message
                                      ? html`<span class="chat-msg__author" style="${author_style}"
                                                >${is_me_message ? '**' : ''}${username}</span
                                            >&nbsp;`
                                      : ''}`
                            : ''}
                        ${is_retracted ? el.renderRetraction() : el.renderMessageText()}
                    </div>
                    <converse-message-actions
                        .model=${el.model}
                        ?is_retracted=${is_retracted}
                    ></converse-message-actions>
                </div>

                ${!is_retracted ? el.model.get('ogp_metadata')?.map((m) =>
                    el.model.get('hide_url_previews') === true ? '' :
                    html`<converse-message-unfurl
                        @animationend="${el.onUnfurlAnimationEnd}"
                        class="${el.model.get('url_preview_transition')}"
                        jid="${el.model_with_messages?.get('jid')}"
                        description="${m['og:description'] || ''}"
                        title="${m['og:title'] || ''}"
                        image="${(m['og:image'] && shouldRenderMediaFromURL(m['og:image'], 'image')) ? m['og:image'] : nothing}"
                        site_name="${m['og:site_name'] || ''}"
                        url="${m['og:url'] || ''}"
                    ></converse-message-unfurl>`
                ) : ''}
            </div>
        </div>`;
};
