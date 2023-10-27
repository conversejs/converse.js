import tplIcons from './templates/icons.js';
import { CustomElement } from './element.js';
import { api } from '@converse/headless';

export class FontAwesome extends CustomElement {
    render () {
        return tplIcons();
    }
}

api.elements.define('converse-fontawesome', FontAwesome);
