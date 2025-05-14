import { html } from 'lit';
import { __ } from 'i18n';

/**
 * @param {import("../types").Field} f
 */
function tplField(f) {
    return f.type === 'checkbox'
        ? html`<div class="form-check">
              <input name="${f.name}" class="form-check-input" type="checkbox" id="${f.name}" />
              <label class="form-check-label" for="${f.name}">${f.label}</label>
          </div>`
        : html`<div class="mb-3">
              <label class="form-label" for="${f.name}">
                  ${f.label || ''}
              </label>
              <input
                  type="text"
                  name="${f.name}"
                  class="${f.challenge_failed ? 'is-invalid' : ''} form-control"
                  ?required="${f.required}"
                  placeholder="${f.placeholder}"
                  id="${f.name}"
              />
              ${f.challenge_failed ? html`<div class="invalid-feedback">Please provide a valid input.</div>` : ''}
          </div>`;
}

/**
 * @param {import('../confirm').default} el
 */
export default (el) => {
    const first_msg = el.model.get('messages')?.[0];
    const subsequent_msgs = el.model.get('messages')?.slice(1) || [];
    return html`<form
        class="converse-form converse-form--modal confirm"
        action="#"
        @submit=${(ev) => el.onConfimation(ev)}
    >
        <div class="mb-3 lh-base"><strong>${first_msg}</strong></div>
        <div class="mb-3">${subsequent_msgs?.map(/** @param {string} msg */ (msg) => html`<p>${msg}</p>`)}</div>
        ${el.model.get('fields')?.map(/** @param {import('../types').Field} f */ (f) => tplField(f))}
        <div class="d-flex justify-content-end">
            <button type="submit" class="btn btn-primary me-2">${__('Confirm')}</button>
            <input type="button" class="btn btn-secondary" data-bs-dismiss="modal" value="${__('Cancel')}" />
        </div>
    </form>`;
};
