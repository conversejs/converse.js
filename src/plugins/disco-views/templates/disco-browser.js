import { html } from 'lit';
import { until } from 'lit/directives/until.js';
import { _converse } from '@converse/headless';
import { __ } from 'i18n';
import { getJIDsAutoCompleteList } from 'plugins/rosterview/utils';

/**
 * @param {import('../disco-browser').default} el
 */
export default (el) => {
    const disco = el.getDiscoInfo();
    const input_jid = el._entity_jids[el._entity_jids.length - 1];
    return html` <h4 class="mt-3 text-center">${__('Discover Services')}</h4>
        <form class="mt-2 mb-3" @submit="${(ev) => el.queryEntity(ev)}">
            <div class="d-flex w-100">
                <converse-autocomplete
                    .getAutoCompleteList="${getJIDsAutoCompleteList}"
                    class="w-100"
                    min_chars="2"
                    name="entity_jid"
                    position="below"
                    required
                    value="${input_jid}"
                ></converse-autocomplete>
                <button type="submit" class="btn btn-outline-secondary">${__('Inspect')}</button>
            </div>
        </form>

        <nav aria-label="breadcrumb">
            <ol class="breadcrumb">
                <li>${__('Service')}:&nbsp;</li>
                ${el._entity_jids.map(
                    (jid, index) => html`
                        <li class="breadcrumb-item">
                            <a href="#" @click="${(ev) => el.handleBreadcrumbClick(ev, index)}">${jid}</a>
                        </li>
                    `
                )}
            </ol>
        </nav>

        ${until(
            disco.then(() => ''),
            html`<converse-spinner></converse-spinner>`
        )}
        ${until(
            disco.then(({ error }) => (error ? html`<div class="alert alert-danger" role="alert">${error}</div>` : '')),
            ''
        )}

        <div class="container">
            ${until(
                disco.then(({ identities }) =>
                    identities?.length
                        ? html`<h5 class="mt-3">${__('Identities')}</h5>
                              <ul class="items-list identities">
                                  ${identities.map(
                                      (i) =>
                                          html`<li class="list-item">
                                              <ul class="list-unstyled">
                                                  ${i.get('name')
                                                      ? html`<li><strong>${__('Name')}:</strong> ${i.get('name')}</li>`
                                                      : ''}
                                                  ${i.get('type')
                                                      ? html`<li><strong>${__('Type')}:</strong> ${i.get('type')}</li>`
                                                      : ''}
                                                  ${i.get('category')
                                                      ? html`<li>
                                                            <strong>${__('Category')}:</strong> ${i.get('category')}
                                                        </li>`
                                                      : ''}
                                              </ul>
                                          </li>`
                                  )}
                              </ul>`
                        : ''
                ),
                ''
            )}
            ${until(
                disco.then(({ items }) =>
                    items?.length
                        ? html`<h5 class="mt-3">${__('Items')}</h5>
                              <ul class="items-list disco-items">
                                  ${items.map(
                                      (i) =>
                                          html`<li class="list-item">
                                              <a @click="${(ev) => el.addEntityJID(ev, i)}">${el.renderItem(i)}</a>
                                          </li>`
                                  )}
                              </ul>`
                        : ''
                ),
                ''
            )}
            ${until(
                disco.then(({ features }) =>
                    features?.length
                        ? html`
                              <h5 class="mt-3">${__('Features')}</h5>
                              <ul class="items-list features">
                                  ${features.map((f) => html`<li class="list-item">${f}</li>`)}
                              </ul>
                          `
                        : ''
                ),
                ''
            )}
        </div>`;
};
