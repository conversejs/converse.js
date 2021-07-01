import { CustomElement } from './element.js';
import { converse } from "@converse/headless/core";

const u = converse.env.utils;


export default class DropdownBase extends CustomElement {

    connectedCallback() {
        super.connectedCallback();
        this.registerEvents();
    }

    registerEvents() {
        this.clickOutside = (ev) => this._clickOutside(ev);
        document.addEventListener('click', this.clickOutside);
    }

    firstUpdated () {
        super.firstUpdated();
        this.menu = this.querySelector('.dropdown-menu');
        this.button = this.querySelector('button');
        this.addEventListener('click', ev => this.toggleMenu(ev));
        this.addEventListener('keyup', ev => this.handleKeyUp(ev));
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
        }
    }

    disconnectedCallback () {
        document.removeEventListener('click', this.clickOutside);
        super.disconnectedCallback();
    }
}
