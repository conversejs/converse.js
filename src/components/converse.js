import { api, converse } from "@converse/headless/converse-core";


/**
 * `converse-root` is an optional custom element which can be used to
 * declaratively insert the Converse UI into the DOM.
 *
 * It can be inserted into the DOM before or after Converse has loaded or been
 * initialized.
 */
class ConverseRoot extends HTMLElement {

    async connectedCallback () {
        await api.waitUntil('initialized');
        converse.insertInto(this);
    }
}

customElements.define('converse-root', ConverseRoot);
