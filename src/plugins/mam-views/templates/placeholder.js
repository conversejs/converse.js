import { html } from "lit/html.js";
import { __ } from "i18n";
import tplSpinner from "templates/spinner.js";

/**
 * @param {import('../placeholder').default} el
 */
export default (el) => {
    return el.model.get("fetching")
        ? tplSpinner({ classes: "hor_centered" })
        : html`<a @click="${(ev) => el.fetchMissingMessages(ev)}" title="${__('Click to load missing messages')}">
              <div class="message mam-placeholder"></div>
          </a>`;
};
