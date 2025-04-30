import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplBackground from './templates/background_logo.js';
import { getTheme } from './utils.js';

import './styles/background.scss';


class ConverseBackground extends CustomElement {

    static get properties() {
        return {
            logo: { type: Boolean },
        };
    }

    initialize() {
        this.setThemeAttributes();

        const settings = api.settings.get();
        this.listenTo(settings, 'change:view_mode', () => this.setThemeAttributes())
        this.listenTo(settings, 'change:singleton', () => this.setThemeAttributes())
        window.matchMedia('(prefers-color-scheme: dark)').addListener(() => this.setThemeAttributes());
        window.matchMedia('(prefers-color-scheme: light)').addListener(() => this.setThemeAttributes());
    }

    render() {
        return tplBackground(this);
    }

    setThemeAttributes () {
        const theme = getTheme();
        this.classList.add(`theme-${theme}`);
        this.setAttribute('data-converse-theme', theme);
        this.setAttribute('data-bs-theme', theme);
        this.requestUpdate();
    }
}


api.elements.define('converse-bg', ConverseBackground);

export default ConverseBackground;
