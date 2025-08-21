import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplAppSwitcher from './templates/app-switcher.js';

import './styles/app-switcher.scss';

export default class AppSwitcher extends CustomElement {
    static get properties() {
        return {
            _activeApp: { type: String },
        };
    }

    constructor() {
        super();
        this._activeApp = 'chat';
    }

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
        api.apps.switch(name);
        this.requestUpdate();
    }
}

api.elements.define('converse-app-switcher', AppSwitcher);
