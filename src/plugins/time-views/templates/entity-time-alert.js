import { html } from 'lit';
import { __ } from 'i18n';

/**
 * @param {import('../entity-time-alert').default} el
 */
export default (el) => {
    const display_name = el.getDisplayName();
    const formatted_time = el.getFormattedTime();

    const i18n_time_warning = __("%1$s's local time is %2$s", display_name, formatted_time);
    const i18n_dismiss = __('Dismiss');

    return html`
        <div class="entity-time-alert">
            <converse-icon class="fa fa-clock" size="1em"></converse-icon>
            <span class="entity-time-alert__message">${i18n_time_warning}</span>
            <button
                type="button"
                class="entity-time-alert__dismiss"
                aria-label="${i18n_dismiss}"
                title="${i18n_dismiss}"
                @click=${/** @param {MouseEvent} ev */ (ev) => el.dismiss(ev)}
            >
                <converse-icon class="fa fa-times" size="0.875em"></converse-icon>
            </button>
        </div>
    `;
};
