import 'shared/chat/unfurl.js';
import { __ } from 'i18n';
import { html } from "lit";
import { renderAvatar } from 'shared/directives/avatar';


export default (el, o) => {
    const i18n_new_messages = __('New messages');
    return html`
        ${ o.is_first_unread ? html`<div class="message separator"><hr class="separator"><span class="separator-text">${ i18n_new_messages }</span></div>` : '' }
        <div class="message chat-msg ${ el.getExtraMessageClasses() }"
                data-isodate="${o.time}"
                data-msgid="${o.msgid}"
                data-from="${o.from}"
                data-encrypted="${o.is_encrypted}">

            <!-- Anchor to allow us to scroll the message into view -->
            <a id="${o.msgid}"></a>

            <a class="show-msg-author-modal" @click=${el.showUserModal}>${ o.should_show_avatar ? renderAvatar(el.getAvatarData()) : '' }</a>
            <div class="chat-msg__content chat-msg__content--${o.sender} ${o.is_me_message ? 'chat-msg__content--action' : ''}">

                ${ !o.is_me_message ? html`
                    <span class="chat-msg__heading">
                        <span class="chat-msg__author"><a class="show-msg-author-modal" @click=${el.showUserModal}>${o.username}</a></span>
                        ${ o.hats.map(h => html`<span class="badge badge-secondary">${h.title}</span>`) }
                        <time timestamp="${el.model.get('edited') || el.model.get('time')}" class="chat-msg__time">${o.pretty_time}</time>
                        ${ o.is_encrypted ? html`<span class="fa fa-lock"></span>` : '' }
                    </span>` : '' }
                <div class="chat-msg__body chat-msg__body--${o.message_type} ${o.received ? 'chat-msg__body--received' : '' } ${o.is_delayed ? 'chat-msg__body--delayed' : '' }">
                    <div class="chat-msg__message">
                        ${ (o.is_me_message) ? html`
                            <time timestamp="${o.edited || o.time}" class="chat-msg__time">${o.pretty_time}</time>&nbsp;
                            <span class="chat-msg__author">${ o.is_me_message ? '**' : ''}${o.username}</span>&nbsp;` : '' }
                        ${ o.is_retracted ? el.renderRetraction() : el.renderMessageText() }
                    </div>
                    <converse-message-actions
                        .model=${el.model}
                        ?correcting=${o.correcting}
                        ?editable=${o.editable}
                        ?hide_url_previews=${el.model.get('hide_url_previews')}
                        ?is_retracted=${o.is_retracted}
                        unfurls="${el.model.get('ogp_metadata')?.length}"
                        message_type="${o.message_type}"></converse-message-actions>
                </div>

                ${ !el.model.get('hide_url_previews') ? el.model.get('ogp_metadata')?.map(m =>
                    html`<converse-message-unfurl
                        @animationend="${el.onUnfurlAnimationEnd}"
                        class="${el.model.get('url_preview_transition')}"
                        jid="${el.chatbox?.get('jid')}"
                        description="${m['og:description'] || ''}"
                        title="${m['og:title'] || ''}"
                        image="${m['og:image'] || ''}"
                        url="${m['og:url'] || ''}"></converse-message-unfurl>`) : '' }
            </div>
        </div>`;
}
