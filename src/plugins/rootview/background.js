import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplBackground from './templates/background_logo.js';
import { getTheme } from './utils.js';

import './styles/background.scss';


class ConverseBackground extends CustomElement {

    initialize() {
        this.setClasses();
    }

    render() {
        return tplBackground();
    }

    setClasses () {
        this.classList.add(`theme-${getTheme()}`);
        this.requestUpdate();
    }
}


api.elements.define('converse-bg', ConverseBackground);

export default ConverseBackground;
