import 'shared/components/image-picker.js';
import tplSpinner from 'templates/spinner.js';
import { __ } from 'i18n';
import { api, converse, parsers } from '@converse/headless';
import { html } from 'lit';
import '../styles/config.scss';

const u = converse.env.utils;

/**
 * @param {import('../config').default} el
 */
export default (el) => {
    const whitelist = api.settings.get('roomconfig_whitelist');
    let fieldTemplates = [];
    let instructions = '';
    let title = __('Loading configuration form');

    const config_stanza = el.model.session.get('config_stanza');
    if (config_stanza) {
        const stanza = u.toStanza(config_stanza);
        let { fields } = parsers.parseXForm(stanza);

        if (whitelist.length) {
            fields = fields.filter((f) => whitelist.includes(f.var));
        }
        const options = {
            new_password: !el.model.features.get('passwordprotected'),
            fixed_username: el.model.get('jid'),
        };
        fieldTemplates = fields.map((f) => u.xFormField2TemplateResult(f, options));
        instructions = stanza.querySelector('instructions')?.textContent;
        title = stanza.querySelector('title')?.textContent;
    }

    const i18n_save = __('Save');
    return html`
        <form
            class="converse-form chatroom-form ${fieldTemplates.length ? '' : 'converse-form--spinner'}"
            autocomplete="off"
            @submit=${ev => el.submitConfigForm(ev)}
        >
            <fieldset class="form-group">
                <legend class="centered">${title}</legend>
                ${title !== instructions ? html`<p class="form-help">${instructions}</p>` : ''}

                ${fieldTemplates.length ? html`<div class="row">
                    <converse-image-picker .model=${el.model} width="96" height="96"></converse-image-picker>
                </div>` : ''}

                ${fieldTemplates.length ? fieldTemplates : tplSpinner({ 'classes': 'hor_centered' })}
            </fieldset>

            ${fieldTemplates.length
                ? html` <fieldset>
                      <input type="submit" class="btn btn-primary" value="${i18n_save}" />
                  </fieldset>`
                : ''}
        </form>
    `;
};
