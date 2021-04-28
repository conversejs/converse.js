import tpl_root from "./templates/root.js";
import { api } from '@converse/headless/core';
import { CustomElement } from 'shared/components/element.js';


/**
 * `converse-root` is an optional custom element which can be used to
 * declaratively insert the Converse UI into the DOM.
 *
 * It can be inserted into the DOM before or after Converse has loaded or been
 * initialized.
 */
class ConverseRoot extends CustomElement {

    render () { // eslint-disable-line class-methods-use-this
        return tpl_root();
    }

    connectedCallback () {
        super.connectedCallback();
        this.classList.add(`converse-${api.settings.get('view_mode')}`);
        this.setAttribute('class', 'conversejs');
    }
}

customElements.define('converse-root', ConverseRoot);
