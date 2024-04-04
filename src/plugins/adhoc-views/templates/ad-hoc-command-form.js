/**
 * @typedef {import('../adhoc-commands').default} AdHocCommands
 * @typedef {import('../adhoc-commands').AdHocCommandUIProps} AdHocCommandUIProps
 */
import { html } from 'lit';
import { __ } from 'i18n';

const ACTION_MAP = {
    execute: __('Execute'),
    prev: __('Previous'),
    next: __('Next'),
    complete: __('Complete'),
};

const NOTE_ALERT_MAP = {
    'info': 'primary',
    'warn': 'secondary',
    'error': 'danger',
};

/**
 * @param {AdHocCommands} el
 * @param {AdHocCommandUIProps} command
 */
export default (el, command) => {
    const i18n_cancel = __('Cancel');

    return html`
        <span>
            <!-- Don't remove this <span>,
                 this is a workaround for a lit bug where a <form> cannot be removed
                 if it contains an <input> with name "remove" -->
            <form class="converse-form">
                ${command.alert
                    ? html`<div class="alert alert-${command.alert_type}" role="alert">${command.alert}</div>`
                    : ''}
                ${command.note
                    ? html`<div class="alert alert-${NOTE_ALERT_MAP[command.note.type || 'info']}" role="alert">
                          ${command.note.text}
                      </div>`
                    : ''}

                <fieldset class="form-group">
                    <input type="hidden" name="command_node" value="${command.node}" />
                    <input type="hidden" name="command_jid" value="${command.jid}" />

                    ${command.instructions ? html`<p class="form-instructions">${command.instructions}</p>` : ''}
                    ${command.fields ?? []}
                </fieldset>
                ${command.actions?.length
                    ? html` <fieldset>
                          ${command.actions?.map(
                              (action) =>
                                  html`<input
                                      data-action="${action}"
                                      @click=${(ev) => el.executeAction(ev)}
                                      type="button"
                                      class="btn btn-primary"
                                      value="${ACTION_MAP[action]}"
                                  />`
                          )}
                          <input
                              type="button"
                              class="btn btn-secondary button-cancel"
                              value="${i18n_cancel}"
                              @click=${(ev) => el.cancel(ev)}
                          />
                      </fieldset>`
                    : ''}
            </form>
        </span>
    `;
};
