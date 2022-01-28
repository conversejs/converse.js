import tpl_root from "./templates/root.js";
import { api } from '@converse/headless/core';
import { CustomElement } from 'shared/components/element.js';
import { getAppSettings } from '@converse/headless/shared/settings/utils.js';
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
        return tpl_root();
    }

    initialize () {
        this.setAttribute('id', 'conversejs');
        this.setClasses();
        const settings = getAppSettings();
        this.listenTo(settings, 'change:view_mode', () => this.setClasses())
        this.listenTo(settings, 'change:singleton', () => this.setClasses())
        window.matchMedia('(prefers-color-scheme: dark)').addListener(() => this.setClasses());
        window.matchMedia('(prefers-color-scheme: light)').addListener(() => this.setClasses());
    }

    setClasses () {
        this.className = "";
        this.classList.add('conversejs');
        this.classList.add(`converse-${api.settings.get('view_mode')}`);
        this.classList.add(`theme-${getTheme()}`);
        this.requestUpdate();
    }
}
