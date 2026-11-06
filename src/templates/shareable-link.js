import { html } from 'lit';
import { log } from '@converse/headless';
import { __ } from 'i18n';
import 'shared/components/copy-button.js';

/**
 * Hand the link to the OS share sheet (Web Share API).
 * @param {MouseEvent} ev
 * @param {string} link
 */
async function share(ev, link) {
    ev.preventDefault();
    try {
        await navigator.share({ url: link });
    } catch (e) {
        // An AbortError only means the user closed the share sheet.
        if (e?.name !== 'AbortError') log.warn(`Could not share ${link}: ${e}`);
    }
}

/**
 * A shareable invitation link (see `getShareableLink`), with a button that
 * copies it to the clipboard and, where the browser has the Web Share API
 * (mostly on mobile), one that opens the OS share sheet.
 *
 * The link opens in a new tab, showing what whoever it's shared with gets,
 * rather than being handled in-app like one in a message: from our own
 * profile, that would only open a chat with ourselves.
 * @param {string} link
 */
export default (link) => {
    const i18n_copy_link = __('Copy link to clipboard');
    const i18n_share_link = __('Share link');
    return html`<span class="shareable-link d-inline-flex align-items-center gap-1">
        <a href="${link}" target="_blank" rel="noopener">${link}</a>
        <converse-copy-button .text=${link} label="${i18n_copy_link}"></converse-copy-button>
        ${
            typeof navigator.share === 'function'
                ? html`<button
                      type="button"
                      class="btn btn-sm share-button"
                      title="${i18n_share_link}"
                      aria-label="${i18n_share_link}"
                      @click=${(ev) => share(ev, link)}
                  >
                      <converse-icon size="1em" class="fa fa-share-nodes"></converse-icon>
                  </button>`
                : ''
        }
    </span>`;
};
