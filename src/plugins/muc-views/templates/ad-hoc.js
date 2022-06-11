import tpl_command from './ad-hoc-command.js';
import { __ } from 'i18n';
import { getAutoCompleteList } from '../utils.js';
import { html } from "lit";


export default (o) => {
    const i18n_choose_service = __('On which entity do you want to run commands?');
    const i18n_choose_service_instructions = __(
        'Certain XMPP services and entities allow privileged users to execute ad-hoc commands on them.');
    const i18n_commands_found = __('Commands found');
    const i18n_fetch_commands = __('List available commands');
    const i18n_jid_placeholder = __('XMPP Address');
    const i18n_no_commands_found = __('No commands found');
    return html`
        ${ o.alert ? html`<div class="alert alert-${o.alert_type}" role="alert">${o.alert}</div>` : '' }
        <form class="converse-form" @submit=${o.fetchCommands}>
            <fieldset class="form-group">
                <label>
                    ${i18n_choose_service}
                    <p class="form-help">${i18n_choose_service_instructions}</p>
                    <converse-autocomplete
                        .getAutoCompleteList="${getAutoCompleteList}"
                        placeholder="${i18n_jid_placeholder}"
                        name="jid">
                    </converse-autocomplete>
                </label>
            </fieldset>
            <fieldset class="form-group">
                <input type="submit" class="btn btn-primary" value="${i18n_fetch_commands}">
            </fieldset>
            ${ o.view === 'list-commands' ? html`
            <fieldset class="form-group">
                <ul class="list-group">
                    <li class="list-group-item active">${ o.commands.length ? i18n_commands_found : i18n_no_commands_found }:</li>
                    ${ o.commands.map(cmd => tpl_command(o, cmd)) }
                </ul>
            </fieldset>`
            : '' }

        </form>
    `;
}
