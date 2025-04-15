import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplNavbar from './templates/navbar.js';
import './modals/about.js';

class NavBar extends CustomElement {
    render() {
        return tplNavbar(this);
    }

    /**
     * @param {Event} ev
     */
    openAboutDialog(ev) {
        ev.preventDefault();
        api.modal.show('converse-about-modal');
    }
}

api.elements.define('converse-controlbox-navbar', NavBar);

export default NavBar;
