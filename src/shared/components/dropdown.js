/**
 * @typedef {module:dom-navigator.DOMNavigatorOptions} DOMNavigatorOptions
 */
import { html } from 'lit';
import { until } from 'lit/directives/until.js';
import { api, constants, u } from "@converse/headless";
import DOMNavigator from "shared/dom-navigator.js";
import DropdownBase from 'shared/components/dropdownbase.js';
import 'shared/components/icons.js';
import { __ } from 'i18n';

import './styles/dropdown.scss';

const { KEYCODES } = constants;


export default class Dropdown extends DropdownBase {

    static get properties () {
        return {
            icon_classes: { type: String },
            items: { type: Array }
        }
    }

    constructor () {
        super();
        this.icon_classes = 'fa fa-bars';
        this.items = [];
        this.id = u.getUniqueId();
        this.addEventListener('hidden.bs.dropdown', () => this.onHidden());
        this.addEventListener('keyup', (ev) => this.handleKeyUp(ev));
    }

    render () {
        return html`
            <button class="btn btn--transparent btn--standalone dropdown-toggle dropdown-toggle--no-caret"
                    id="${this.id}"
                    type="button"
                    data-bs-toggle="dropdown"
                    aria-haspopup="true"
                    aria-expanded="false"
                    aria-label=${ __('Menu') }>
                <converse-icon aria-hidden="true" size="1em" class="${ this.icon_classes }">
            </button>
            <ul class="dropdown-menu" aria-labelledby="${this.id}">
                ${ this.items.map(b => html`<li>${until(b, '')}</li>`) }
            </ul>
        `;
    }

    firstUpdated () {
        super.firstUpdated();
        this.initArrowNavigation();
    }

    onHidden () {
        this.navigator?.disable();
    }

    initArrowNavigation () {
        if (!this.navigator) {
            const options = /** @type DOMNavigatorOptions */({
                'selector': '.dropdown-item',
                'onSelected': (el) => el.focus()
            });
            this.navigator = new DOMNavigator(/** @type HTMLElement */(this.menu), options);
        }
    }

    enableArrowNavigation (ev) {
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
        }
        this.navigator.enable();
        this.navigator.select(/** @type HTMLElement */(this.menu.firstElementChild));
    }

    handleKeyUp (ev) {
        if (ev.keyCode === KEYCODES.DOWN_ARROW && !this.navigator.enabled) {
            this.enableArrowNavigation(ev);
        }
    }
}

api.elements.define('converse-dropdown', Dropdown);
