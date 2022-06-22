import 'shared/components/icons.js';
import DOMNavigator from "shared/dom-navigator.js";
import DropdownBase from 'shared/components/dropdownbase.js';
import { KEYCODES } from '@converse/headless/shared/constants.js';
import { api } from "@converse/headless/core.js";
import { html } from 'lit';
import { until } from 'lit/directives/until.js';

import './styles/dropdown.scss';


export default class Dropdown extends DropdownBase {

    static get properties () {
        return {
            'icon_classes': { type: String },
            'color': { type: String },
            'items': { type: Array }
        }
    }

    constructor () {
        super();
        this.color = 'var(--text-color)';
        this.icon_classes = 'fa fa-bars';
    }

    render () {
        return html`
            <button type="button" class="btn btn--transparent btn--standalone" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                <converse-icon color="${this.color}" size="1em" class="${ this.icon_classes }">
            </button>
            <div class="dropdown-menu">
                ${ this.items.map(b => until(b, '')) }
            </div>
        `;
    }

    firstUpdated () {
        super.firstUpdated();
        this.initArrowNavigation();
    }

    connectedCallback () {
        super.connectedCallback();
        this.hideOnEscape = ev => (ev.keyCode === KEYCODES.ESCAPE && this.hideMenu());
        document.addEventListener('keydown', this.hideOnEscape);
    }

    disconnectedCallback() {
        document.removeEventListener('keydown', this.hideOnEscape);
        super.disconnectedCallback();
    }

    hideMenu () {
        super.hideMenu();
        this.navigator?.disable();
    }

    initArrowNavigation () {
        if (!this.navigator) {
            const options = {
                'selector': '.dropdown-item',
                'onSelected': el => el.focus()
            };
            this.navigator = new DOMNavigator(this.menu, options);
        }
    }

    enableArrowNavigation (ev) {
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
        }
        this.navigator.enable();
        this.navigator.select(this.menu.firstElementChild);
    }

    handleKeyUp (ev) {
        super.handleKeyUp(ev);
        if (ev.keyCode === KEYCODES.DOWN_ARROW && !this.navigator.enabled) {
            this.enableArrowNavigation(ev);
        }
    }
}

api.elements.define('converse-dropdown', Dropdown);
