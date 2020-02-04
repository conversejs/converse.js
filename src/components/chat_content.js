import { BootstrapModal } from "../converse-modal.js";
import { LitElement, html, css } from 'lit-element';
import { __ } from '@converse/headless/i18n';
import { repeat } from 'lit-html/directives/repeat.js';
import converse from "@converse/headless/converse-core";
import dayjs from 'dayjs';
import filesize from "filesize";
import tpl_csn from "../templates/csn.js";
import tpl_file_progress from "../templates/file_progress.js";
import tpl_info from "../templates/info.js";
import tpl_message from "../templates/message.js";
import tpl_message_versions_modal from "../templates/message_versions_modal.js";
import tpl_new_day from "../templates//new_day.js";
import 'fa-icons';

const u = converse.env.utils;

const i18n_no_history = __('No message history available.');
const tpl_no_msgs = html`<div class="empty-history-feedback"><span>${i18n_no_history}</span></div>`


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



class ChatContent extends LitElement {

    static get properties () {
        return {
            _converse: { type: Object },
            model: { type: Object },
            changed: { type: Object }
        }
    }

    static get styles () {
        return css`
            .mention {
                font-weight: bold;
            }
            .mention--self {
                font-weight: normal;
            }
            .chat-msg {
                display: inline-flex;
                width: 100%;
                flex-direction: row;
                overflow: auto; // Ensures that content stays inside
                padding: 0.125rem 1rem;
            }
            .chat-msg__content {
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: stretch;
                margin-left: 0.5rem;
                width: calc(100% - var(--message-avatar-width));
            }
            .chat-msg__body {
                display: flex;
                flex-direction: row;
                justify-content: space-between;
            }
            .chat-msg__message {
                display: inline-flex;
                flex-direction: column;
                width: 100%;
                overflow-wrap: break-word;
            }
            .chat-msg__content--action {
                width: 100%;
                margin-left: 0;
            }
            .chat-msg__subject {
                font-weight: bold;
                clear: right;
            }
            .chat-msg__text {
                color: var(--message-text-color);
                padding: 0;
                width: 100%;
                white-space: pre-wrap;
                word-wrap: break-word;
                word-break: break-word;
            }
            .chat-msg__text--larger {
                font-size: 1.6em;
                padding-top: 0.25em;
                padding-bottom: 0.25em;
            }
            .chat-msg__actions {
                display: flex;
                flex-wrap: nowrap;
            }
            .chat-msg__action {
                font-size: var(--message-font-size);
                padding: 0.125em;
                margin-left: 0.75em;
                border: none;
                background: transparent;
                cursor: pointer;
            }
            .chat-msg__action:focus {
                display: block;
            }

            .chat-msg__content--me .chat-msg__body--groupchat {
                .chat-msg__text {
                    color: var(--subdued-color);
                }
            }
            .chat-msg__body--delayed .chat-msg__text,
            .chat-msg__body--received .chat-msg__text {
                color: var(--message-text-color);
            }
        `;
    }

    render () {
        return html`
            ${repeat(this.model.messages, msg => msg.get('id'), msg => renderMessage(this._converse, msg)) }
            ${ !this.model.messages.length ? tpl_no_msgs : '' }
        `;
    }
}

customElements.define('converse-chat-content', ChatContent);
