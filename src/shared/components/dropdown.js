import DOMNavigator from "shared/dom-navigator.js";
import { CustomElement } from './element.js';
import { converse, api } from "@converse/headless/core";
import { html } from 'lit';
import { until } from 'lit/directives/until.js';

const u = converse.env.utils;


export class BaseDropdown extends CustomElement {

    connectedCallback() {
        super.connectedCallback();
        this.registerEvents();
    }

    registerEvents() {
        this.clickOutside = this._clickOutside.bind(this);
        document.addEventListener('click', this.clickOutside);
    }

    firstUpdated () {
        super.firstUpdated();
        this.initArrowNavigation();
        this.menu = this.querySelector('.dropdown-menu');
        this.dropdown = this.firstElementChild;
        this.button = this.dropdown.querySelector('button');
        this.dropdown.addEventListener('click', ev => this.toggleMenu(ev));
        this.dropdown.addEventListener('keyup', ev => this.handleKeyUp(ev));
    }

    _clickOutside(ev) {
        if (!this.contains(ev.composedPath()[0])) {
            this.hideMenu(ev);
        }
    }

    hideMenu () {
        u.removeClass('show', this.menu);
        this.button?.setAttribute('aria-expanded', false);
        this.button?.blur();
    }

    showMenu () {
        u.addClass('show', this.menu);
        this.button.setAttribute('aria-expanded', true);
    }

    toggleMenu (ev) {
        ev.preventDefault();
        if (u.hasClass('show', this.menu)) {
            this.hideMenu();
        } else {
            this.showMenu();
        }
    }

    handleKeyUp (ev) {
        if (ev.keyCode === converse.keycodes.ESCAPE) {
            this.hideMenu();
        } else if (ev.keyCode === converse.keycodes.DOWN_ARROW && this.navigator && !this.navigator.enabled) {
            this.enableArrowNavigation(ev);
        }
    }

    disconnectedCallback () {
        document.removeEventListener('click', this.clickOutside);
        super.disconnectedCallback();
    }
}


export default class DropdownList extends BaseDropdown {

    static get properties () {
        return {
            'icon_classes': { type: String },
            'items': { type: Array }
        }
    }

    render () {
        const icon_classes = this.icon_classes || "fa fa-bars";
        return html`
            <div class="dropleft">
                <button type="button" class="btn btn--transparent btn--standalone" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                    <i class="${icon_classes} only-icon"></i>
                </button>
                <div class="dropdown-menu">
                    ${ this.items.map(b => until(b, '')) }
                </div>
            </div>
        `;
    }

    hideMenu () {
        super.hideMenu();
        this.navigator.disable();
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
        if (ev.keyCode === converse.keycodes.DOWN_ARROW && !this.navigator.enabled) {
            this.enableArrowNavigation(ev);
        }
    }
}

api.elements.define('converse-dropdown', DropdownList);
