import tpl_spinner from 'templates/spinner.js';
import { __ } from 'i18n';
import { api, converse } from "@converse/headless/core";
import { html } from "lit";

const { sizzle } = converse.env;
const u = converse.env.utils;

export default (o) => {
    const whitelist = api.settings.get('roomconfig_whitelist');
    const config_stanza = o.model.session.get('config_stanza');
    let fields = [];
    let instructions = '';
    let title;
    if (config_stanza) {
        const stanza = u.toStanza(config_stanza);
        fields = sizzle('field', stanza);
        if (whitelist.length) {
            fields = fields.filter(f => whitelist.includes(f.getAttribute('var')));
        }
        const password_protected = o.model.features.get('passwordprotected');
        const options = {
            'new_password': !password_protected,
            'fixed_username': o.model.get('jid')
        };
        fields = fields.map(f => u.xForm2TemplateResult(f, stanza, options));
        instructions = stanza.querySelector('instructions')?.textContent;
        title = stanza.querySelector('title')?.textContent;
    } else {
        title = __('Loading configuration form');
    }
    const i18n_save = __('Save');
    const i18n_cancel = __('Cancel');
    return html`
        <form class="converse-form chatroom-form ${fields.length ? '' : 'converse-form--spinner'}"
                autocomplete="off"
                @submit=${o.submitConfigForm}>

            <fieldset class="form-group">
                <legend class="centered">${title}</legend>
                ${ (title !== instructions) ? html`<p class="form-help">${instructions}</p>` : '' }
                ${ fields.length ? fields : tpl_spinner({'classes': 'hor_centered'}) }
            </fieldset>
            ${ fields.length ? html`
                <fieldset>
                    <input type="submit" class="btn btn-primary" value="${i18n_save}">
                    <input type="button" class="btn btn-secondary button-cancel" value="${i18n_cancel}" @click=${o.closeConfigForm}>
                </fieldset>` : '' }
        </form>
    `;
}
