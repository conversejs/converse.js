import { html } from 'lit';
import { __ } from 'i18n';

/**
 * @param {import('../approval-alert').default} el
 */
export default (el) => {
    return el.contact
        ? html`
              <div class="alert alert-info d-flex flex-column align-items-center mb-0 p-3 text-center">
                  <p class="mb-2">${__('Would you like to add %1$s as a contact?', el.contact.getDisplayName())}</p>
                  <div class="btn-group">
                      <button
                          type="button"
                          class="btn btn-sm btn-success"
                          @click=${/** @param {MouseEvent} ev */ (ev) => el.showAddContactModal(ev)}
                      >
                          ${__('Add')}
                      </button>
                      <button
                          type="button"
                          class="btn btn-sm btn-danger"
                          @click=${/** @param {MouseEvent} ev */ (ev) => el.close(ev)}
                      >
                          ${__('Dismiss')}
                      </button>
                  </div>
              </div>
          `
        : '';
};
