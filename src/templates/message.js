import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';
import { renderAvatar, renderRetractionLink, transformBodyText } from './directives';
import dayjs from 'dayjs';
import converse from  "@converse/headless/converse-core";


const u = converse.env.utils;

const i18n_edit_message = __('Edit this message');
const i18n_edited = __('This message has been edited');
const i18n_show = __('Show more');


function getRetractionText (o) {
    if (o.model.get('type') === 'groupchat' && o.model.get('moderated_by')) {
        const retracted_by_mod = o.model.get('moderated_by');
        const chatbox = o.model.collection.chatbox;
        if (!o.model.mod) {
            o.model.mod =
                chatbox.occupants.findOccupant({'jid': retracted_by_mod}) ||
                chatbox.occupants.findOccupant({'nick': Strophe.getResourceFromJid(retracted_by_mod)});
        }
        const modname = o.model.mod ? o.model.mod.getDisplayName() : 'A moderator';
        return __('%1$s has removed this message', modname);
    } else {
        return __('%1$s has removed this message', o.model.getDisplayName());
    }
}


function getExtraMessageClasses (o) {
    const extra_classes = [
        ...(o.model.get('is_delayed') ? ['delayed'] : []),
        ...(o.is_retracted ? ['chat-msg--retracted'] : [])
    ];
    if (o.model.get('type') === 'groupchat') {
        if (o.model.occupant) {
            extra_classes.push(o.model.occupant.get('role'));
            extra_classes.push(o.model.occupant.get('affiliation'));
        }
        if (o.model.get('sender') === 'them' && o.model.collection.chatbox.isUserMentioned(o.model)) {
            // Add special class to mark groupchat messages
            // in which we are mentioned.
            extra_classes.push('mentioned');
        }
    }
    if (o.model.get('correcting')) {
        extra_classes.push('correcting');
    }
    return extra_classes.filter(c => c).join(" ");
}


function isFollowup(o) {
    const messages = o.model.collection.models;
    const idx = messages.indexOf(o.model);
    const prev_model = idx ? messages[idx-1] : null;
    if (prev_model === null) {
        return false;
    }
    const date = dayjs(o.isodate);
    return o.model.get('from') === prev_model.get('from') &&
        !o.is_me_message &&
        !u.isMeCommand(prev_model.getMessageText()) &&
        o.model.get('type') !== 'info' &&
        prev_model.get('type') !== 'info' &&
        date.isBefore(dayjs(prev_model.get('time')).add(10, 'minutes')) &&
        o.model.get('is_encrypted') === prev_model.get('is_encrypted');
}


const tpl_spoiler_hint = (o) => html`
    <div class="chat-msg__spoiler-hint">
        <span class="spoiler-hint">${o.spoiler_hint}</span>
        <a class="badge badge-info spoiler-toggle" data-toggle-state="closed" href="#"><i class="fa fa-eye"></i>${i18n_show}</a>
    </div>
`;

const tpl_retraction = (o) => {
    const retraction_text = o.is_retracted ? getRetractionText(o) : null;
    return html`
        <div>${retraction_text}</div>
        ${ o.moderation_reason ? html`<q class="chat-msg--retracted__reason">${o.moderation_reason}</q>` : '' }
    `;
}

const tpl_message_text = (o) => {
    const url = o.model.get('oob_url');
    return html`
        ${ o.is_spoiler ? tpl_spoiler_hint(o) : '' }
        ${ o.secbject ? html`<div class="chat-msg__subject">${o.subject}</div>` : '' }
        <div class="chat-msg__text ${o.is_only_emojis ? 'chat-msg__text--larger' : ''} ${o.is_spoiler ? 'spoiler collapsed' : ''}">${transformBodyText(o._converse, o.model)}</div>
        ${ url ? html`<div class="chat-msg__media">${u.getOOBURLMarkup(o._converse, url)}</div>` : '' }
    `;
}

const tpl_avatar_byline = (o) => html`
    ${ o.roles.map(role => html`<span class="badge badge-secondary">${role}</span>`) }
    <time timestamp="${o.isodate}" class="chat-msg__time">${o.pretty_time}</time>
`;


export default (o) => {
    const is_groupchat_message = o.model.get('type') === 'groupchat';
    const username = o.model.getDisplayName();

    return html`
        <div class="message chat-msg ${o.type} ${getExtraMessageClasses(o)}
                    ${ o.is_me_message ? 'chat-msg--action' : '' }
                    ${isFollowup(o) ? 'chat-msg--followup' : ''}"
                data-isodate="${o.time}" data-msgid="${o.msgid}" data-from="${o.from}" data-encrypted="${o.is_encrypted}">

            ${ renderAvatar(o) }
            <div class="chat-msg__content chat-msg__content--${o.sender} ${o.is_me_message ? 'chat-msg__content--action' : ''}">
                <span class="chat-msg__heading">
                    ${ (o.is_me_message) ? html`<time timestamp="${o.isodate}" class="chat-msg__time">${o.pretty_time}</time>` : '' }
                    <span class="chat-msg__author">${ o.is_me_message ? '**' : ''}${username}</span>
                    ${ !o.is_me_message ? tpl_avatar_byline(o) : '' }
                    ${ o.is_encrypted ? html`<span class="fa fa-lock"></span>` : '' }
                </span>
                <div class="chat-msg__body chat-msg__body--${o.type} ${o.received ? 'chat-msg__body--received' : '' } ${o.is_delayed ? 'chat-msg__body--delayed' : '' }">
                    <div class="chat-msg__message">
                        ${ o.is_retracted ? tpl_retraction(o) : tpl_message_text(o) }
                    </div>
                    ${ (o.received && !o.is_me_message && !is_groupchat_message) ? html`<span class="fa fa-check chat-msg__receipt"></span>` : '' }
                    ${ (o.edited) ? html`<i title="${ i18n_edited }" class="fa fa-edit chat-msg__edit-modal" @click=${o.showMessageVersionsModal}></i>` : '' }
                    <div class="chat-msg__actions">
                        ${ o.editable ?
                            html`<button class="chat-msg__action chat-msg__action-edit" title="${i18n_edit_message}">
                                <fa-icon class="fas fa-pencil-alt" path-prefix="/node_modules" color="var(--text-color-lighten-15-percent)" size="1em"></fa-icon>
                            </button>` : '' }
                        ${ renderRetractionLink(o) }
                    </div>
                </div>
            </div>
        </div>
    `;
}
