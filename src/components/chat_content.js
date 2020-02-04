import { LitElement, html, css } from 'lit-element';
import { __ } from '@converse/headless/i18n';
import { repeat } from 'lit-html/directives/repeat.js';
import converse from "@converse/headless/converse-core";
import dayjs from 'dayjs';
import filesize from "filesize";
import tpl_csn from "../templates/csn.js";
import tpl_file_progress from "../templates/file_progress.js";
import tpl_info from "../templates/info.js";
import tpl_new_day from "../templates//new_day.js";
import 'fa-icons';
import "../components/message";

const u = converse.env.utils;

const i18n_no_history = __('No message history available.');
const tpl_no_msgs = html`<div class="empty-history-feedback"><span>${i18n_no_history}</span></div>`


function renderChatMessage (_converse, model) {
    const text = model.getMessageText();
    const time = dayjs(model.get('time'));
    const role = model.vcard ? model.vcard.get('role') : null;
    const roles = role ? role.split(',') : [];
    const username = model.getDisplayName();
    const is_retracted = model.get('retracted') || model.get('moderated') === 'retracted';
    const is_groupchat = (model.get('type') === 'groupchat');
    const has_mentions = is_groupchat && model.collection.chatbox.isUserMentioned(model);
    return html`
        <converse-chat-message
            .model=${model}
            .roles=${roles}
            ._converse=${_converse}
            ?allow_message_retraction=${_converse.allow_message_retraction}
            ?correcting=${model.get('correcting')}
            ?editable=${model.get('editable')}
            ?has_mentions=${has_mentions}
            ?is_delayed=${model.get('is_delayed')}
            ?is_encrypted=${model.get('is_encrypted')}
            ?is_me_message=${u.isMeCommand(text)}
            ?is_only_emojis=${model.get('is_only_emojis')}
            ?is_retracted=${is_retracted}
            ?is_spoiler=${model.get('is_spoiler')}

            from=${model.get('from')}
            moderated_by=${model.get('moderated_by') || ''}
            moderation_reason=${model.get('moderation_reason') || ''}
            msgid=${model.get('msgid')}
            occupant_affiliation=${model.occupant ? model.occupant.get('affiliation') : ''}
            occupant_role=${model.occupant ? model.occupant.get('role') : ''}
            oob_url=${model.get('oob_url') || ''}
            pretty_time=${time.format(_converse.time_format)}
            pretty_type=${model.get('pretty_type')}
            received=${model.get('received')}
            sender=${model.get('sender')}
            spoiler_hint=${model.get('spoiler_hint') || ''}
            subject=${model.get('subject') || ''}
            time=${model.get('time')}
            message_type=${model.get('type')}
            username=${username}></converse-chat-message>
    `;
}

function renderDayIndicator (model) {
    const day_date = dayjs(model.get('isodate'));
    return tpl_new_day(Object.assign(
        model.toJSON(), {
            'datestring': day_date.format("dddd MMM Do YYYY")
        })
    );
}

function renderInfoMessage (model) {
    return tpl_info(Object.assign(model.toJSON(), {
        'extra_classes': 'chat-info',
        'onRetryClicked': () => model.error.retry(),
        'isodate': dayjs(model.get('time')).toISOString()
    }));
}

function renderErrorMessage (model) {
    return tpl_info(Object.assign(model.toJSON(), {
        'extra_classes': 'chat-error',
        'onRetryClicked': () => model.error.retry(),
        'isodate': dayjs(model.get('time')).toISOString()
    }));
}

function renderChatStateNotification (_converse, model) {
    let text;
    const from = model.get('from');
    const name = model.getDisplayName();

    if (model.get('chat_state') === _converse.COMPOSING) {
        if (model.get('sender') === 'me') {
            text = __('Typing from another device');
        } else {
            text = __('%1$s is typing', name);
        }
    } else if (model.get('chat_state') === _converse.PAUSED) {
        if (model.get('sender') === 'me') {
            text = __('Stopped typing on the other device');
        } else {
            text = __('%1$s has stopped typing', name);
        }
    } else if (model.get('chat_state') === _converse.GONE) {
        text = __('%1$s has gone away', name);
    } else {
        return html``;
    }
    return tpl_csn({
        'message': text,
        'from': from,
        'isodate': (new Date()).toISOString()
    });
}

function renderFileUploadProgresBar (model) {
    return tpl_file_progress(
        Object.assign(model.toJSON(), {
            'filename': model.file.name,
            'filesize': filesize(model.file.size)
        }));
}


function renderMessage (_converse, model) {
    if (model.get('dangling_retraction')) {
        return;
    }
    if (model.isOnlyChatStateNotification(model)) {
        return renderChatStateNotification(_converse, model)
    } else if (model.get('file') && !model.get('oob_url')) {
        return renderFileUploadProgresBar(model);
    } else if (model.get('type') === 'error') {
        return renderErrorMessage(model);
    } else if (model.get('type') === 'info') {
        return renderInfoMessage(model);
    } else if (model.get('type') === 'date') {
        return renderDayIndicator(model);
    } else {
        return renderChatMessage(_converse, model);
    }
}



class ChatContent extends LitElement {

    static get properties () {
        return {
            _converse: { type: Object },
            model: { type: Object },
            changed: { type: Object }
        }
    }

    render () {
        return html`
            ${repeat(this.model.messages, msg => msg.get('id'), msg => renderMessage(this._converse, msg)) }
            ${ !this.model.messages.length ? tpl_no_msgs : '' }
        `;
    }

    createRenderRoot () {
        // Render without the shadow DOM
        return this;
    }
}

customElements.define('converse-chat-content', ChatContent);
