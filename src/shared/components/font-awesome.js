import { CustomElement } from './element.js';
import tpl_icons from '../templates/icons.js';

export class FontAwesome extends CustomElement {
    render () {  // eslint-disable-line class-methods-use-this
        return tpl_icons();
    }
}

window.customElements.define('converse-fontawesome', FontAwesome);
