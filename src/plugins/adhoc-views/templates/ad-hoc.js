/**
 * @typedef {import('../adhoc-commands').default} AdHocCommands
 */
import tplCommand from './ad-hoc-command.js';
import tplSpinner from 'templates/spinner.js';
import { __ } from 'i18n';
import { getAutoCompleteList } from 'plugins/muc-views/utils.js';
import { html } from 'lit';

/**
 * @param {AdHocCommands} el
 */
export default (el) => {
    const i18n_choose_service = __('On which entity do you want to run commands?');
    const i18n_choose_service_instructions = __(
        'Certain XMPP services and entities allow privileged users to execute ad-hoc commands on them.'
    );
    const i18n_commands_found = __('Commands found');
    const i18n_fetch_commands = __('List available commands');
    const i18n_jid_placeholder = __('XMPP Address');
    const i18n_no_commands_found = __('No commands found');
    return html`
        ${el.alert ? html`<div class="alert alert-${el.alert_type}" role="alert">${el.alert}</div>` : ''}
        ${el.note ? html`<p class="form-help">${el.note}</p>` : ''}

        <form class="converse-form" @submit=${el.fetchCommands}>
            <fieldset class="form-group">
                <label>
                    ${i18n_choose_service}
                    <p class="form-help">${i18n_choose_service_instructions}</p>
                    <converse-autocomplete
                        .getAutoCompleteList="${getAutoCompleteList}"
                        required
                        placeholder="${i18n_jid_placeholder}"
                        name="jid"
                    >
                    </converse-autocomplete>
                </label>
            </fieldset>
            <fieldset class="form-group">
                ${el.fetching
                    ? tplSpinner()
                    : html`<input type="submit" class="btn btn-primary" value="${i18n_fetch_commands}" />`}
            </fieldset>
            ${el.view === 'list-commands'
                ? html` <fieldset class="form-group">
                      <ul class="list-group">
                          <li class="list-group-item active">
                              ${el.commands.length ? i18n_commands_found : i18n_no_commands_found}:
                          </li>
                          ${el.commands.map((cmd) => tplCommand(el, cmd))}
                      </ul>
                  </fieldset>`
                : ''}
        </form>
    `;
};
