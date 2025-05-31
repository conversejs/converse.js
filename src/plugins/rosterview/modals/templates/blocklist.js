import { __ } from 'i18n';
import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

/**
 * @param {import('../blocklist.js').default} el
 */
export default (el) => {
    if (el.blocklist.length) {
        const filtered_blocklist = el.filter_text
            ? el.blocklist.filter((b) => b.get('jid').toLowerCase().includes(el.filter_text.toLowerCase()))
            : el.blocklist;

        return html`
            <form @submit="${(ev) => el.unblockUsers(ev)}">
                <div class="d-flex justify-content-between">
                    ${el.blocklist.length > 5
                        ? html`<p style="line-height: 3em">
                              ${__('%1$s blocked users shown', filtered_blocklist.length)}
                          </p>`
                        : ''}
                    ${filtered_blocklist.length
                        ? html`<div class="text-end">
                              <button type="submit" class="btn btn-danger mt-2 mb-2">
                                  ${__('Unblock selected users')}
                              </button>
                          </div>`
                        : ''}
                </div>
                ${el.blocklist.length > 5
                    ? html`
                          <div class="mb-3  ${el.filter_text ? 'input-group' : ''}">
                              <input
                                  autofocus
                                  name="blocklist_filter"
                                  type="text"
                                  class="form-control"
                                  value="${el.filter_text}"
                                  placeholder="${__('Filter blocked users')}"
                                  @input="${(ev) => (el.filter_text = ev.target.value)}"
                              />
                              <button
                                  type="button"
                                  class="btn btn-outline-secondary ${!el.filter_text ? 'hidden' : ''}"
                                  @click=${() => {
                                      el.filter_text = '';
                                      const input = /** @type {HTMLInputElement} */ (
                                          el.querySelector('input[name="blocklist_filter"]')
                                      );
                                      input.value = '';
                                  }}
                              >
                                  <converse-icon size="1em" class="fa fa-times"></converse-icon>
                                  ${__('clear')}
                              </button>
                          </div>
                          <div class="form-check mb-1">
                              <input
                                  class="form-check-input"
                                  type="checkbox"
                                  id="select-all"
                                  @change="${(ev) => el.toggleSelectAll(ev)}"
                              />
                              <label class="form-check-label" for="select-all">
                                  <strong>${__('Select All')}</strong></label
                              >
                          </div>
                      `
                    : ''}
                <ul class="items-list">
                    ${repeat(
                        filtered_blocklist,
                        (b) => b.get('jid'),
                        (b) =>
                            html`<li
                                class="list-item"
                                @click="${(ev) => {
                                    if (ev.target.type === 'checkbox') return;
                                    ev.preventDefault();
                                    const checkbox = /** @type {HTMLInputElement} */ (
                                        document.getElementById(`blocklist-${b.get('jid')}`)
                                    );
                                    checkbox.checked = !checkbox.checked;
                                }}"
                            >
                                <div class="form-check">
                                    <input
                                        class="form-check-input"
                                        type="checkbox"
                                        id="blocklist-${b.get('jid')}"
                                        name="${b.get('jid')}"
                                    />
                                    <label class="form-check-label w-100" for="blocklist-${b.get('jid')}">
                                        ${b.get('jid')}
                                    </label>
                                </div>
                            </li>`
                    )}
                </ul>
            </form>
        `;
    } else {
        return html`<p>${__('No blocked XMPP addresses')}</p>`;
    }
};
