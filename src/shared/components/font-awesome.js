import tpl_icons from '../templates/icons.js';
import { CustomElement } from './element.js';
import { api } from '@converse/headless/core.js';

export class FontAwesome extends CustomElement {
    render () {  // eslint-disable-line class-methods-use-this
        return tpl_icons();
    }
}

api.elements.define('converse-fontawesome', FontAwesome);
