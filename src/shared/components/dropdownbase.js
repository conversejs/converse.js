import { Dropdown as BootstrapDropdown } from 'bootstrap';
import { CustomElement } from './element.js';

export default class DropdownBase extends CustomElement {

    firstUpdated (changed) {
        super.firstUpdated(changed);
        this.menu = this.querySelector('.dropdown-menu');
        this.button = this.querySelector('button');
        this.dropdown = new BootstrapDropdown(/** @type {HTMLElement} */(this.button));
    }
}
