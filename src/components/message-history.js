import "../components/message";
import dayjs from 'dayjs';
import tpl_new_day from "../templates//new_day.js";
import { CustomElement } from './element.js';
import { __ } from '@converse/headless/i18n';
import { api } from "@converse/headless/converse-core";
import { html } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat.js';

const i18n_no_history = __('No message history available.');

const tpl_message = (o) => html`
    <converse-chat-message
        .chatview=${o.chatview}
        .hats=${o.hats}
        .model=${o.model}
        ?allow_retry=${o.retry}
        ?correcting=${o.correcting}
        ?editable=${o.editable}
        ?has_mentions=${o.has_mentions}
        ?is_delayed=${o.is_delayed}
        ?is_encrypted=${o.is_encrypted}
        ?is_me_message=${o.is_me_message}
        ?is_only_emojis=${o.is_only_emojis}
        ?is_retracted=${o.is_retracted}
        ?is_spoiler=${o.is_spoiler}
        ?is_spoiler_visible=${o.is_spoiler_visible}
        ?retractable=${o.retractable}
        edited=${o.edited || ''}
        error=${o.error || ''}
        error_text=${o.error_text || ''}
        filename=${o.filename || ''}
        filesize=${o.filesize || ''}
        from=${o.from}
        message_type=${o.type || ''}
        moderated_by=${o.moderated_by || ''}
        moderation_reason=${o.moderation_reason || ''}
        msgid=${o.msgid}
        occupant_affiliation=${o.model.occupant ? o.model.occupant.get('affiliation') : ''}
        occupant_role=${o.model.occupant ? o.model.occupant.get('role') : ''}
        oob_url=${o.oob_url || ''}
        pretty_type=${o.pretty_type}
        progress=${o.progress || 0 }
        reason=${o.reason || ''}
        received=${o.received || ''}
        sender=${o.sender}
        spoiler_hint=${o.spoiler_hint || ''}
        subject=${o.subject || ''}
        time=${o.time}
        username=${o.username}></converse-chat-message>
`;


// Return a TemplateResult indicating a new day if the passed in message is
// more than a day later than its predecessor.
function getDayIndicator (model) {
    const models = model.collection.models;
    const idx = models.indexOf(model);
    const prev_model =  models[idx-1];
    if (!prev_model || dayjs(model.get('time')).isAfter(dayjs(prev_model.get('time')), 'day')) {
        const day_date = dayjs(model.get('time')).startOf('day');
        return tpl_new_day({
            'type': 'date',
            'time': day_date.toISOString(),
            'datestring': day_date.format("dddd MMM Do YYYY")
        });
    }
}


class MessageHistory extends CustomElement {

    static get properties () {
        return {
            chatview: { type: Object},
            messages: { type: Array}
        }
    }

    render () {
        const msgs = this.messages;
        return msgs.length ?
            html`${repeat(msgs, m => m.get('id'), m => this.renderMessage(m)) }` :
            html`<div class="empty-history-feedback form-help"><span>${i18n_no_history}</span></div>`;
    }

    renderMessage (model) {
        // XXX: leaky abstraction "is_only_key" from converse-omemo
        if (model.get('dangling_retraction') || model.get('is_only_key')) {
            return '';
        }
        const day = getDayIndicator(model);
        const templates = day ? [day] : [];
        const is_retracted = model.get('retracted') || model.get('moderated') === 'retracted';
        const is_groupchat = model.get('type') === 'groupchat';

        let hats = [];
        if (is_groupchat) {
            if (api.settings.get('muc_hats_from_vcard')) {
                const role = model.vcard ? model.vcard.get('role') : null;
                hats = role ? role.split(',') : [];
            } else {
                hats = model.occupant?.get('hats') || [];
            }
        }

        const chatbox = this.chatview.model;
        const has_mentions = is_groupchat && model.get('sender') === 'them' && chatbox.isUserMentioned(model);
        const message = tpl_message(
            Object.assign(model.toJSON(), {
                'chatview': this.chatview,
                'is_me_message': model.isMeCommand(),
                'occupant': model.occupant,
                'username': model.getDisplayName(),
                has_mentions,
                hats,
                is_retracted,
                model,
            }));
        return [...templates, message];
    }
}

customElements.define('converse-message-history', MessageHistory);
