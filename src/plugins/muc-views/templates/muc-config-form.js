import tplSpinner from 'templates/spinner.js';
import { __ } from 'i18n';
import { api, converse, parsers } from '@converse/headless';
import { html } from 'lit';

const u = converse.env.utils;

export default (o) => {
    const whitelist = api.settings.get('roomconfig_whitelist');
    const config_stanza = o.model.session.get('config_stanza');
    let fieldTemplates = [];
    let instructions = '';
    let title = __('Loading configuration form');

    if (config_stanza) {
        const stanza = u.toStanza(config_stanza);
        let { fields } = parsers.parseXForm(stanza);

        if (whitelist.length) {
            fields = fields.filter((f) => whitelist.includes(f.var));
        }
        const options = {
            new_password: !o.model.features.get('passwordprotected'),
            fixed_username: o.model.get('jid'),
        };
        fieldTemplates = fields.map((f) => u.xFormField2TemplateResult(f, stanza, options));
        instructions = stanza.querySelector('instructions')?.textContent;
        title = stanza.querySelector('title')?.textContent;
    }

    const i18n_save = __('Save');
    const i18n_cancel = __('Cancel');
    return html`
        <form
            class="converse-form chatroom-form ${fieldTemplates.length ? '' : 'converse-form--spinner'}"
            autocomplete="off"
            @submit=${o.submitConfigForm}
        >
            <fieldset class="form-group">
                <legend class="centered">${title}</legend>
                ${title !== instructions ? html`<p class="form-help">${instructions}</p>` : ''}
                ${fieldTemplates.length ? fieldTemplates : tplSpinner({ 'classes': 'hor_centered' })}
            </fieldset>
            ${fieldTemplates.length
                ? html` <fieldset>
                      <input type="submit" class="btn btn-primary" value="${i18n_save}" />
                      <input
                          type="button"
                          class="btn btn-secondary button-cancel"
                          value="${i18n_cancel}"
                          @click=${o.closeConfigForm}
                      />
                  </fieldset>`
                : ''}
        </form>
    `;
};
