import { html } from 'lit';
import { __ } from 'i18n';

/**
 * @param {import('../scan.js').default} el
 */
export default (el) => {
    if (el.scanning) {
        return html`<div class="social-scan social-scan--scanning">
            <span class="social-scan__progress">${__('Finding… %1$s / %2$s', el.scanned, el.scan_total)}</span>
            <button
                type="button"
                class="social-scan__cancel"
                title="${__('Cancel')}"
                aria-label="${__('Cancel')}"
                @click=${() => el.cancelScan()}
            >
                <converse-icon class="fa fa-times" size="0.9em"></converse-icon>
            </button>
        </div>`;
    }

    return html`<button type="button" class="social-scan__btn" @click=${() => el.scan()}>
        <converse-icon class="fa fa-search" size="0.9em"></converse-icon> ${__('Find people to follow')}
    </button>`;
};
