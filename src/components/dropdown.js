import { html } from 'lit-element';
import { CustomElement } from './element.js';
import { until } from 'lit-html/directives/until.js';
import DOMNavigator from "../dom-navigator";
import converse from "@converse/headless/converse-core";


const u = converse.env.utils;



export class Dropdown extends CustomElement {

    static get properties () {
        return {
            'items': { type: Array }
        }
    }

    render () {
        return html`
            <div class="dropleft">
                <button type="button" class="btn btn--transparent btn--standalone" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                    <i class="fa fa-bars only-icon"></i>
                </button>
                <div class="dropdown-menu">
                    ${ this.items.map(b => until(b, '')) }
                </div>
            </div>
        `;
    }

    firstUpdated () {
        this.menu = this.querySelector('.dropdown-menu');
        this.dropdown = this.firstElementChild;
        this.button = this.dropdown.querySelector('button');
        this.dropdown.addEventListener('click', ev => this.toggleMenu(ev));
        this.dropdown.addEventListener('keyup', ev => this.handleKeyUp(ev));
        document.addEventListener('click', ev => !this.contains(ev.target) && this.hideMenu(ev));
        this.initArrowNavigation();
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

    hideMenu () {
        u.removeClass('show', this.menu);
        this.navigator.disable();
        this.button.setAttribute('aria-expanded', false);
        this.button.blur();
    }

    showMenu () {
        u.addClass('show', this.menu);
        this.button.setAttribute('aria-expanded', true);
    }

    toggleMenu () {
        if (u.hasClass('show', this.menu)) {
            this.hideMenu();
        } else {
            this.showMenu();
        }
    }

    handleKeyUp (ev) {
        if (ev.keyCode === converse.keycodes.ESCAPE) {
            this.hideMenu();
        } else if (ev.keyCode === converse.keycodes.DOWN_ARROW && !this.navigator.enabled) {
            this.enableArrowNavigation(ev);
        }
    }
}

window.customElements.define('converse-dropdown', Dropdown);
