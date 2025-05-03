import debounce from 'lodash-es/debounce';
import { CustomElement } from 'shared/components/element.js';
import { api } from '@converse/headless';

import './styles/list-filter.scss';

/**
 * A component that exposes a text input to enable filtering of a list of DOM items.
 */
export default class ListFilter extends CustomElement {
    constructor() {
        super();
        this.items = null;
        this.model = null;
        this.template = null;
        this.promise = Promise.resolve();
    }

    static get properties() {
        return {
            items: { type: Array },
            model: { type: Object },
            promise: { type: Promise },
            template: { type: Object },
        };
    }

    initialize() {
        this.liveFilter = debounce((ev) => this.model.save({ 'text': ev.target.value }), 250);

        this.listenTo(this.items, 'add', () => this.requestUpdate());
        this.listenTo(this.items, 'destroy', () => this.requestUpdate());
        this.listenTo(this.items, 'remove', () => this.requestUpdate());

        this.listenTo(this.model, 'change', () => {
            this.dispatchUpdateEvent();
            this.requestUpdate();
        });

        this.promise.then(() => this.requestUpdate());
        this.requestUpdate();
    }

    render() {
        return this.shouldBeVisible() ? this.template(this) : '';
    }

    dispatchUpdateEvent() {
        this.dispatchEvent(new CustomEvent('update', { 'detail': this.model.changed }));
    }

    /**
     * @param {Event} ev
     */
    changeChatStateFilter(ev) {
        ev && ev.preventDefault();
        const state = /** @type {HTMLInputElement} */ (this.querySelector('.state-type')).value;
        this.model.save({ state });
    }

    /**
     * @param {Event} ev
     */
    changeTypeFilter(ev) {
        ev && ev.preventDefault();
        const target = /** @type {HTMLInputElement} */ (ev.target);
        const type = /** @type {HTMLElement} */ (target.closest('converse-icon'))?.dataset.type || 'items';
        if (type === 'state') {
            const state = /** @type {HTMLInputElement} */ (this.querySelector('.state-type')).value;
            this.model.save({ type, state });
        } else {
            const text = /** @type {HTMLInputElement} */ (this.querySelector('.items-filter')).value;
            this.model.save({ type, text });
        }
    }

    /**
     * @param {Event} ev
     */
    submitFilter(ev) {
        ev?.preventDefault();
        this.liveFilter();
    }

    /**
     * Returns true if the filter is enabled (i.e. if the user
     * has added values to the filter).
     * @returns {boolean}
     */
    isActive() {
        return this.model.get('type') === 'state' || this.model.get('text');
    }

    /**
     * @returns {boolean}
     */
    shouldBeVisible() {
        return this.items?.length >= 5 || this.isActive();
    }

    /**
     * @param {Event} ev
     */
    clearFilter(ev) {
        ev && ev.preventDefault();
        this.model.save({ 'text': '' });
    }
}

api.elements.define('converse-list-filter', ListFilter);
