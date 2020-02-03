import { html } from "lit-html";
import { repeat } from 'lit-html/directives/repeat.js';
import { BootstrapModal } from "../converse-modal.js";
import { __ } from '@converse/headless/i18n';
import converse from "@converse/headless/converse-core";
import dayjs from 'dayjs';
import tpl_csn from "./csn.js";
import tpl_info from "./info.js";
import tpl_message from "./message.js";
import tpl_message_versions_modal from "./message_versions_modal.js";
import tpl_new_day from "./new_day.js";

const u = converse.env.utils;


const MessageVersionsModal = BootstrapModal.extend({
    // FIXME: this isn't globally unique
    id: "message-versions-modal",
    toHTML () {
        return tpl_message_versions_modal(this.model.toJSON());
    }
});


function showMessageVersionsModal (ev, model) {
    ev.preventDefault();
    if (model.message_versions_modal === undefined) {
        model.message_versions_modal = new MessageVersionsModal({'model': model});
    }
    model.message_versions_modal.show(ev);
}


function renderChatMessage (_converse, model) {
    const text = model.getMessageText();
    const time = dayjs(model.get('time'));
    const role = model.vcard ? model.vcard.get('role') : null;
    const roles = role ? role.split(',') : [];
    const is_retracted = model.get('retracted') || model.get('moderated') === 'retracted';
    return tpl_message(
        Object.assign(
            model.toJSON(), {
            _converse,
            is_retracted,
            'allow_message_retraction': _converse.allow_message_retraction,
            'is_me_message': u.isMeCommand(text),
            'model': model,
            'occupant': model.occupant,
            'pretty_time': time.format(_converse.time_format),
            'roles': roles,
            'showMessageVersionsModal': ev => showMessageVersionsModal(ev, model),
            'time': time.toISOString(),
        })
    );
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

const i18n_no_history = __('No message history available.');

const tpl_no_msgs = html`<div class="empty-history-feedback"><span>${i18n_no_history}</span></div>`

export default (o) => html`
    ${repeat(o.messages, msg => msg.get('id'), (msg, idx) => renderMessage(o._converse, msg)) }
    ${ !o.messages.length ? tpl_no_msgs : '' }
`;
