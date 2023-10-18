import debounce from "lodash-es/debounce";
import { CustomElement } from 'shared/components/element.js';
import { api } from "@converse/headless";

import './styles/contacts-filter.scss';


export class ContactsFilter extends CustomElement {

    constructor () {
        super();
        this.contacts = null;
        this.filter = null;
        this.template = null;
        this.promise = Promise.resolve();
    }

    static get properties () {
        return {
            contacts: { type: Array },
            filter: { type: Object },
            promise: { type: Promise },
            template: { type: Object },
        }
    }

    initialize () {
        this.liveFilter = debounce((ev) => this.filter.save({'filter_text': ev.target.value}), 250);

        this.listenTo(this.contacts, "add", () => this.requestUpdate());
        this.listenTo(this.contacts, "destroy", () => this.requestUpdate());
        this.listenTo(this.contacts, "remove", () => this.requestUpdate());

        this.listenTo(this.filter, 'change', () => {
            this.dispatchUpdateEvent();
            this.requestUpdate();
        });

        this.promise.then(() => this.requestUpdate());
        this.requestUpdate();
    }

    render () {
        return this.shouldBeVisible() ? this.template(this) : '';
    }

    dispatchUpdateEvent () {
        this.dispatchEvent(new CustomEvent('update', { 'detail': this.filter.changed }));
    }

    /**
     * @param {Event} ev
     */
    changeChatStateFilter (ev) {
        ev && ev.preventDefault();
        this.filter.save({'chat_state': /** @type {HTMLInputElement} */(this.querySelector('.state-type')).value});
    }

    /**
     * @param {Event} ev
     */
    changeTypeFilter (ev) {
        ev && ev.preventDefault();
        const target = /** @type {HTMLInputElement} */(ev.target);
        const type = /** @type {HTMLElement} */(target.closest('converse-icon'))?.dataset.type || 'contacts';
        if (type === 'state') {
            this.filter.save({
                'filter_type': type,
                'chat_state': /** @type {HTMLInputElement} */(this.querySelector('.state-type')).value
            });
        } else {
            this.filter.save({
                'filter_type': type,
                'filter_text': /** @type {HTMLInputElement} */(this.querySelector('.contacts-filter')).value
            });
        }
    }

    /**
     * @param {Event} ev
     */
    submitFilter (ev) {
        ev && ev.preventDefault();
        this.liveFilter();
    }

    /**
     * Returns true if the filter is enabled (i.e. if the user
     * has added values to the filter).
     * @returns {boolean}
     */
    isActive () {
        return (this.filter.get('filter_type') === 'state' || this.filter.get('filter_text'));
    }

    /**
     * @returns {boolean}
     */
    shouldBeVisible () {
        return this.contacts?.length >= 5 || this.isActive();
    }

    /**
     * @param {Event} ev
     */
    clearFilter (ev) {
        ev && ev.preventDefault();
        this.filter.save({'filter_text': ''});
    }
}

api.elements.define('converse-contacts-filter', ContactsFilter);
