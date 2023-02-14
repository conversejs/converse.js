import { __ } from 'i18n';
import { html } from "lit";


const action_map = {
    execute: __('Execute'),
    prev: __('Previous'),
    next: __('Next'),
    complete: __('Complete'),
}

export default (el, command) => {
    const i18n_cancel = __('Cancel');

    return html`
        <span> <!-- Don't remove this <span>,
                    this is a workaround for a lit bug where a <form> cannot be removed
                    if it contains an <input> with name "remove" -->
            <form>
            ${ command.alert ? html`<div class="alert alert-${command.alert_type}" role="alert">${command.alert}</div>` : '' }
            <fieldset class="form-group">
                <input type="hidden" name="command_node" value="${command.node}"/>
                <input type="hidden" name="command_jid" value="${command.jid}"/>

                <p class="form-instructions">${command.instructions}</p>
                ${ command.fields }
            </fieldset>
            <fieldset>
                ${ command.actions.map((action) =>
                    html`<input data-action="${action}"
                        @click=${(ev) => el.executeAction(ev)}
                        type="button"
                        class="btn btn-primary"
                        value="${action_map[action]}">`)
                 }<input type="button"
                       class="btn btn-secondary button-cancel"
                       value="${i18n_cancel}"
                       @click=${(ev) => el.cancel(ev)}>
            </fieldset>
        </form>
        </span>
    `;
}
