import "./message";
import dayjs from 'dayjs';
import tpl_new_day from "./templates/new-day.js";
import { CustomElement } from 'shared/components/element.js';
import { _converse, api } from "@converse/headless/core";
import { html } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat.js';


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
// This is set to _converse so that it can be overriden. An attempt was made to use
// a hook instead, but hook returns a promise and it forces the asynchronicity up
// to the render method.
_converse.getHats = function (model) {
    if (model.get('type') === 'groupchat') {
        const allowed_hats = api.settings.get('muc_hats').filter(hat => hat).map((hat) => (hat.toLowerCase()));
        let vcard_roles = []
        if (allowed_hats.includes('vcard_roles')) {
            vcard_roles = model.vcard ? model.vcard.get('role') : null;
            vcard_roles = vcard_roles ? vcard_roles.split(',').filter(hat => hat).map((hat) => ({title: hat})) : [];
        }
        const muc_role = model.occupant ? [model.occupant.get('role')] : [];
        const muc_affiliation = model.occupant ? [model.occupant.get('affiliation')] : [];

        const affiliation_role_hats = [...muc_role, ...muc_affiliation]
            .filter(hat => hat).filter((hat) => (allowed_hats.includes(hat.toLowerCase())))
            .map((hat) => ({title: hat}));
        const hats = allowed_hats.includes('xep317') ? model.occupant?.get('hats') || [] : [];
        return [...hats, ...vcard_roles, ...affiliation_role_hats];
    }
    return [];
}


export default class MessageHistory extends CustomElement {

    static get properties () {
        return {
            model: { type: Object},
            messages: { type: Array}
        }
    }

    render () {
        const msgs = this.messages;
        return msgs.length ? html`${repeat(msgs, m => m.get('id'), m => this.renderMessage(m)) }` : '';
    }

    renderMessage (model) {
        if (model.get('dangling_retraction') || model.get('is_only_key')) {
            return '';
        }
        const day = getDayIndicator(model);
        const templates = day ? [day] : [];
        const message = html`<converse-chat-message
            jid="${this.model.get('jid')}"
            mid="${model.get('id')}"></converse-chat-message>`

        return [...templates, message];
    }
}

api.elements.define('converse-message-history', MessageHistory);
