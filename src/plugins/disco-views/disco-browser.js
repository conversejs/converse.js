import { html } from 'lit';
import { _converse, api } from '@converse/headless';
import { __ } from 'i18n';
import { CustomElement } from 'shared/components/element';
import tplDiscoBrowser from './templates/disco-browser.js';

import './styles/disco-browser.scss';

class DiscoBrowser extends CustomElement {
    static get properties() {
        return {
            _entity_jids: { type: Array, state: true },
        };
    }

    constructor() {
        super();
        this._entity_jids = [_converse.session.get('domain')];
    }

    render() {
        return tplDiscoBrowser(this);
    }

    /**
     * @param {MouseEvent} ev
     * @param {number} index
     */
    handleBreadcrumbClick(ev, index) {
        ev.preventDefault();
        // Update the _entity_jids array to only include up to the clicked index
        this._entity_jids = [...this._entity_jids.slice(0, index + 1)];
    }

    /**
     * @param {SubmitEvent} ev
     */
    queryEntity(ev) {
        ev.preventDefault();
        const form = /** @type {HTMLFormElement} */ (ev.target);
        const data = new FormData(form);
        this._entity_jids = [/** @type {string} */ (data.get('entity_jid')).trim()];
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
    addEntityJID(ev, identity) {
        ev.preventDefault();
        this._entity_jids = [...this._entity_jids, identity.get('jid')];
    }

    async getDiscoInfo() {
        const entity_jid = this._entity_jids[this._entity_jids.length - 1];
        const entity = await api.disco.entities.get(entity_jid, true);
        await entity.waitUntilItemsFetched;
        const error = entity.get('error');
        if (error) {
            if (['item-not-found', 'remote-server-not-found'].includes(error)) {
                return {
                    error: __('No service found with that XMPP address'),
                };
            } else {
                return {
                    error: __('Error: %1$s', error),
                };
            }
        }
        const features = entity.features?.map((f) => f.get('var')) || [];
        const identities = entity.identities || [];
        const item_jids = entity.get('items') || [];
        const items = await Promise.all(item_jids.map(/** @param {string} jid */ (jid) => api.disco.entities.get(jid)));
        return {
            features: features.toSorted?.() || features,
            identities,
            items,
        };
    }
}

api.elements.define('converse-disco-browser', DiscoBrowser);

export default DiscoBrowser;
