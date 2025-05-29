import { html } from 'lit';
import { until } from 'lit/directives/until.js';
import { _converse, api } from '@converse/headless';
import { __ } from 'i18n';
import { CustomElement } from './element';

export class DiscoBrowser extends CustomElement {
    static get properties() {
        return {
            _entity_jid: { type: String, state: true },
        };
    }

    constructor() {
        super();
        this._entity_jid = _converse.session.get('domain');
    }

    render() {
        const disco = this.getDiscoInfo();
        return html`<div class="container">
            ${until(
                disco.then(({ identities }) =>
                    identities.length
                        ? html`<h5 class="mt-3">${__('Identities')}</h5>
                              <ul>
                                  ${identities.map((i) => html`<li>${i.get('name')}</li>`)}
                              </ul>`
                        : ''
                ),
                ''
            )}
            ${until(
                disco.then(({ items }) =>
                    items.length
                        ? html`<h5 class="mt-3">${__('Items')}</h5>
                              <ul>
                                  ${items.map(
                                      (i) =>
                                          html`<li>
                                              <a @click="${(ev) => this.setEntityJID(ev, i)}">${this.renderItem(i)}</a>
                                          </li>`
                                  )}
                              </ul>`
                        : ''
                ),
                ''
            )}
            ${until(
                disco.then(({ features }) =>
                    features.length
                        ? html`
                              <h5 class="mt-3">${__('Features')}</h5>
                              <ul>
                                  ${features.map((f) => html`<li>${f}</li>`)}
                              </ul>
                          `
                        : ''
                ),
                ''
            )}
        </div>`;
    }

    /**
     * @param {import('@converse/headless/types/plugins/disco/entity').default} i
     */
    renderItem(i) {
        return html`${i.get('name') ? `${i.get('name')} <${i.get('jid')}>` : `${i.get('jid')}`}`;
    }

    /**
     * @param {MouseEvent} ev
     * @param {import('@converse/headless/types/plugins/disco/entity').default} identity
     */
    setEntityJID(ev, identity) {
        ev.preventDefault();
        this._entity_jid = identity.get('jid');
    }

    async getDiscoInfo() {
        const entity = await api.disco.entities.get(this._entity_jid);
        const features = entity.features.map((f) => f.get('var'));
        const identities = entity.identities;
        const item_jids = entity.get('items');
        const items = item_jids
            ? await Promise.all(item_jids.map(/** @param {string} jid */ (jid) => api.disco.entities.get(jid)))
            : [];
        return {
            features: features.toSorted?.() || features,
            identities,
            items,
        };
    }
}

api.elements.define('converse-disco-browser', DiscoBrowser);
