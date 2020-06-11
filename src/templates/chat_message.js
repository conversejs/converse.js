import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';
import { renderAvatar } from './../templates/directives/avatar';

const i18n_edited = __('This message has been edited');
const i18n_new_messages = __('New messages');


export default (o) => {
    const is_groupchat_message = (o.message_type === 'groupchat');
    return html`
        ${ o.is_first_unread ? html`<div class="message date-separator"><hr class="separator"><span class="separator-text">${ i18n_new_messages }</span></div>` : '' }
        <div class="message chat-msg ${ o.getExtraMessageClasses() }"
                data-isodate="${o.time}"
                data-msgid="${o.msgid}"
                data-from="${o.from}"
                data-encrypted="${o.is_encrypted}">

            ${ o.shouldShowAvatar() ? renderAvatar(o.getAvatarData()) : '' }
            <div class="chat-msg__content chat-msg__content--${o.sender} ${o.is_me_message ? 'chat-msg__content--action' : ''}">
                <span class="chat-msg__heading">
                    ${ (o.is_me_message) ? html`
                        <time timestamp="${o.time}" class="chat-msg__time">${o.pretty_time}</time>
                        ${o.hats.map(hat => html`<span class="badge badge-secondary">${hat}</span>`)}
                    ` : '' }
                    <span class="chat-msg__author">${ o.is_me_message ? '**' : ''}${o.username}</span>
                    ${ !o.is_me_message ? o.renderAvatarByline() : '' }
                    ${ o.is_encrypted ? html`<span class="fa fa-lock"></span>` : '' }
                </span>
                <div class="chat-msg__body chat-msg__body--${o.message_type} ${o.received ? 'chat-msg__body--received' : '' } ${o.is_delayed ? 'chat-msg__body--delayed' : '' }">
                    <div class="chat-msg__message">
                        ${ o.is_retracted ? o.renderRetraction() : o.renderMessageText() }
                        ${ (o.received && !o.is_me_message && !is_groupchat_message) ? html`<span class="fa fa-check chat-msg__receipt"></span>` : '' }
                        ${ (o.edited) ? html`<i title="${ i18n_edited }" class="fa fa-edit chat-msg__edit-modal" @click=${o.showMessageVersionsModal}></i>` : '' }
                    </div>
                    <converse-message-actions
                        .chatview=${o.chatview}
                        .model=${o.model}
                        ?correcting="${o.correcting}"
                        ?editable="${o.editable}"
                        ?is_retracted="${o.is_retracted}"
                        message_type="${o.message_type}"></converse-message-actions>
                </div>
            </div>
        </div>`;
}
