import tpl_converse from "../templates/converse.js";
import { CustomElement } from './element.js';


/**
 * `converse-root` is an optional custom element which can be used to
 * declaratively insert the Converse UI into the DOM.
 *
 * It can be inserted into the DOM before or after Converse has loaded or been
 * initialized.
 */
class ConverseRoot extends CustomElement {

    render () { // eslint-disable-line class-methods-use-this
        return tpl_converse();
    }
}

customElements.define('converse-root', ConverseRoot);
