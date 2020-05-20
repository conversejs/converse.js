import "../components/message";
import 'fa-icons';
import dayjs from 'dayjs';
import tpl_message from "templates/message.js";
import tpl_new_day from "../templates//new_day.js";
import { CustomElement } from './element.js';
import { __ } from '@converse/headless/i18n';
import { api } from "@converse/headless/converse-core";
import { html } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat.js';

const i18n_no_history = __('No message history available.');
const tpl_no_msgs = html`<div class="empty-history-feedback"><span>${i18n_no_history}</span></div>`


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


function renderMessage (model) {
    // XXX: leaky abstraction "is_only_key" from converse-omemo
    if (model.get('dangling_retraction') || model.get('is_only_key')) {
        return '';
    }
    const day = getDayIndicator(model);
    const templates = day ? [day] : [];
    const is_retracted = model.get('retracted') || model.get('moderated') === 'retracted';
    const is_groupchat_message = model.get('type') === 'groupchat';

    let hats = [];
    if (is_groupchat_message) {
        if (api.settings.get('muc_hats_from_vcard')) {
            const role = model.vcard ? model.vcard.get('role') : null;
            hats = role ? role.split(',') : [];
        } else {
            hats = model.occupant?.get('hats') || [];
        }
    }

    const message = tpl_message(
        Object.assign(model.toJSON(), {
            'is_me_message': model.isMeCommand(),
            'occupant': model.occupant,
            'username': model.getDisplayName(),
            hats,
            is_groupchat_message,
            is_retracted,
            model
        }));

    if (model.collection) {
        // If the model gets destroyed in the meantime, it no
        // longer has a collection.
        model.collection.trigger('rendered', this);
    }
    return [...templates, message];
}


class ChatContent extends CustomElement {

    static get properties () {
        return {
            messages: { type: Array},
        }
    }

    render () {
        const msgs = this.messages;
        return html`${ !msgs.length ? tpl_no_msgs : repeat(msgs, m => m.get('id'), m => renderMessage(m)) }`;
    }
}

customElements.define('converse-chat-content', ChatContent);
