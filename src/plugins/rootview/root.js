import tplRoot from "./templates/root.js";
import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import { getTheme } from './utils.js';

import './styles/root.scss';


/**
 * `converse-root` is an optional custom element which can be used to
 * declaratively insert the Converse UI into the DOM.
 *
 * It can be inserted into the DOM before or after Converse has loaded or been
 * initialized.
 */
export default class ConverseRoot extends CustomElement {

    render () { // eslint-disable-line class-methods-use-this
        return tplRoot();
    }

    initialize () {
        this.setAttribute('id', 'conversejs');
        this.setThemeAttributes();
        const settings = api.settings.get();
        this.listenTo(settings, 'change:view_mode', () => this.setThemeAttributes())
        this.listenTo(settings, 'change:singleton', () => this.setThemeAttributes())
        window.matchMedia('(prefers-color-scheme: dark)').addListener(() => this.setThemeAttributes());
        window.matchMedia('(prefers-color-scheme: light)').addListener(() => this.setThemeAttributes());
    }

    setThemeAttributes() {
        const theme = getTheme();
        this.className = "";
        this.classList.add('container-fluid');
        this.classList.add('g-0');
        this.classList.add('conversejs');
        this.classList.add(`converse-${api.settings.get('view_mode')}`);
        this.classList.add(`theme-${theme}`);
        this.setAttribute('data-bs-theme', theme);
        this.setAttribute('data-converse-theme', theme);
        this.requestUpdate();
    }
}
