import { html } from 'lit';
import { __ } from 'i18n';

/**
 * @param {import("../types").Field} f
 */
function tplField(f) {
    return f.type === 'checkbox'
        ? html` <div class="form-check">
              <input name="${f.name}" class="form-check-input" type="checkbox" value="" id="${f.name}" />
              <label class="form-check-label" for="${f.name}">${f.label}</label>
          </div>`
        : html`<div>
              <label class="form-label">
                  ${f.label || ''}
                  <input
                      type="text"
                      name="${f.name}"
                      class="${f.challenge_failed ? 'error' : ''} form-control form-control--labeled"
                      ?required="${f.required}"
                      placeholder="${f.placeholder}"
                  />
              </label>
          </div>`;
}

/**
 * @param {import('../confirm').default} el
 */
export default (el) => {
    return html` <form
        class="converse-form converse-form--modal confirm"
        action="#"
        @submit=${(ev) => el.onConfimation(ev)}
    >
        <div>${el.model.get('messages')?.map(/** @param {string} msg */ (msg) => html`<p>${msg}</p>`)}</div>
        ${el.model.get('fields')?.map(/** @param {import('../types').Field} f */ (f) => tplField(f))}
        <div>
            <button type="submit" class="btn btn-primary">${__('Confirm')}</button>
            <input type="button" class="btn btn-secondary" data-bs-dismiss="modal" value="${__('Cancel')}" />
        </div>
    </form>`;
};
