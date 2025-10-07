/**
 * @typedef {import('lit').TemplateResult} TemplateResult
 * @typedef {import('../adhoc-commands').default} AdHocCommands
 * @typedef {import('../types').AdHocCommandUIProps} AdHocCommandUIProps
 */
import { html } from 'lit';
import { __ } from 'i18n';
import { xFormField2TemplateResult } from 'utils/html.js';

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
 * @param {AdHocCommandUIProps} command
 */
function tplReportedTable (command) {
    return html`
        <table class="table">
            <thead class="thead-light">
                ${command.reported?.map((r) => html`<th scope="col" data-var="${r.var}">${r.label}</th>`)}
            </thead>
            <tbody>
                ${command.items?.map(
                    (fields) => html`<tr>${fields.map((f) => html`<td data-var="${f.var}">${f.value}</td>`)
                }</tr>`)}
            </tbody>
        </table>
    `;
}

/**
 * @param {AdHocCommands} el
 * @param {AdHocCommandUIProps} command
 */
export default (el, command) => {
    const i18n_cancel = __('Cancel');

    return html`
        <!-- Don't remove this <span>,
                this is a workaround for a lit bug where a <form> cannot be removed
                if it contains an <input> with name "remove" -->
        <span>
            <form class="converse-form">
                ${command.alert
                    ? html`<div class="alert alert-${command.alert_type}" role="alert">${command.alert}</div>`
                    : ''}
                ${command.note
                    ? html`<div class="alert alert-${NOTE_ALERT_MAP[command.note.type || 'info']}" role="alert">
                          ${command.note.text}
                      </div>`
                    : ''}

                ${command.type === 'result' && command.title ?
                        html`<div class="alert alert-info">${command.title}</div>` : ''}

                ${command.type === 'form' && command.title ? html`<h6>${command.title}</h6>` : ''}

                <fieldset>
                    <input type="hidden" name="command_node" value="${command.node}" />
                    <input type="hidden" name="command_jid" value="${command.jid}" />
                    ${command.instructions ? html`<p class="form-instructions">${command.instructions}</p>` : ''}
                    ${command.type === 'result' ? tplReportedTable(command) : ''}
                    ${command.fields?.map(f => xFormField2TemplateResult(f), { domain: command.jid }) ?? ''}
                </fieldset>
                ${command.status === 'completed'
                    ? html` <fieldset>
                          <input
                              type="button"
                              class="btn btn-secondary button-cancel"
                              value="${__('Close')}"
                              @click=${(ev) => el.cancel(ev)}
                          />
                      </fieldset>`
                    : command.actions?.length
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
