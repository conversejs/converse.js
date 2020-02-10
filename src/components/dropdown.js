import { html } from 'lit-element';
import { CustomElement } from './element.js';
import DOMNavigator from "../dom-navigator";
import converse from "@converse/headless/converse-core";


const u = converse.env.utils;


export class Dropdown extends CustomElement {

    static get properties () {
        return {
            'contents': { type: Object }
        }
    }

    render () {
        return html`${this.contents}`
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
            const button = this.querySelector('button');
            button.blur();
            this.hideMenu();
        } else if (ev.keyCode === converse.keycodes.DOWN_ARROW && !this.navigator.enabled) {
            this.enableArrowNavigation(ev);
        }
    }
}

window.customElements.define('converse-dropdown', Dropdown);
