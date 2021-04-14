import { __ } from 'i18n';
import { html } from "lit";

export default (o, command) => {
    const i18n_hide = __('Hide');
    const i18n_run = __('Execute');
    return html`
        <form @submit=${o.runCommand}>
            ${ command.alert ? html`<div class="alert alert-${command.alert_type}" role="alert">${command.alert}</div>` : '' }
            <fieldset class="form-group">
                <input type="hidden" name="command_node" value="${command.node}"/>
                <input type="hidden" name="command_jid" value="${command.jid}"/>

                <p class="form-help">${command.instructions}</p>
                ${ command.fields }
            </fieldset>
            <fieldset>
                <input type="submit" class="btn btn-primary" value="${i18n_run}">
                <input type="button" class="btn btn-secondary button-cancel" value="${i18n_hide}" @click=${o.hideCommandForm}>
            </fieldset>
        </form>
    `;
}
