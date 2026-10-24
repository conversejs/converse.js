import { html, nothing } from 'lit';
import { converse } from '@converse/headless';
import { __ } from 'i18n';
import tplComposerPanel from 'shared/chat/templates/composer-panel.js';

const { u } = converse.env;

/**
 * @param {import('../entity-time-alert').default} el
 * @param {import('@converse/headless/types/plugins/time/types').ContactTime} contact_time
 */
function tplBar(el, contact_time) {
    const display_name = el.getDisplayName();
    const our_tzo = u.time.formatTZO(u.time.getLocalTZOMinutes());

    const i18n_time_warning = __("It's %1$s for %2$s", contact_time.time, display_name);
    // The bar is one line and truncates, and neither offset belongs in it
    // anyway. They're the answer to "says who?", so they go where a reader
    // looks for detail.
    const i18n_offsets = __('Their timezone is UTC%1$s, yours is UTC%2$s', contact_time.tzo, our_tzo);
    const i18n_dismiss = __('Dismiss');

    return tplComposerPanel({
        kind: 'warning',
        icon: html`<converse-icon
            class="fa fa-clock entity-time-alert__icon"
            color="var(--warning-color)"
            size="1em"
        ></converse-icon>`,
        content: html`<span class="entity-time-alert__message" title="${i18n_time_warning}. ${i18n_offsets}.">
            ${i18n_time_warning}
        </span>`,
        close: { label: i18n_dismiss, handler: (ev) => el.dismiss(/** @type {MouseEvent} */ (ev)) },
    });
}

/**
 * @param {import('../entity-time-alert').default} el
 * @param {import('@converse/headless/types/plugins/time/types').ContactTime|null} contact_time -
 *  The contact's time if the warning is due, otherwise null.
 */
export default (el, contact_time) => {
    // The live region is always in the DOM, empty when there's nothing to say.
    // A region that arrives already populated is announced unreliably, since
    // some screen readers only watch regions they were told about beforehand.
    return html`<div role="status" aria-live="polite">${contact_time ? tplBar(el, contact_time) : nothing}</div>`;
};
