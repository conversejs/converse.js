import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import { isURLRoutingEnabled, navigateToApp } from './routing.js';
import tplAppSwitcher from './templates/app-switcher.js';

import './styles/app-switcher.scss';

export default class AppSwitcher extends CustomElement {
    initialize() {
        api.listen.on('appSwitch', () => this.requestUpdate());
    }

    render() {
        return tplAppSwitcher(this);
    }

    /**
     * @param {MouseEvent} ev
     */
    switchApp(ev) {
        ev.preventDefault();
        const a = /** @type {HTMLElement} */ (ev.target).closest('.nav-link');
        const name = a.getAttribute('data-app-name');
        if (isURLRoutingEnabled()) {
            // Forward navigation via the hash (the hashchange handler performs the
            // switch, and the resulting `appSwitch` re-renders this switcher). Push
            // the app's remembered sub-route, so switching back reopens the chat /
            // post you left rather than dropping to the app's bare root.
            navigateToApp(name);
        } else {
            api.apps.switch(name);
            this.requestUpdate();
        }
    }
}

api.elements.define('converse-app-switcher', AppSwitcher);
