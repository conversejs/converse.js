/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Helpers for screen reader users.
 */
import { api } from '@converse/headless';

const LIVE_REGION_ID = 'converse-live-region';

/**
 * @returns {HTMLElement|null}
 */
function getLiveRegion() {
    const root = api.settings.get('root')?.querySelector('converse-root');
    if (!root) return null;

    let region = root.querySelector(`#${LIVE_REGION_ID}`);
    if (!region) {
        region = document.createElement('div');
        region.id = LIVE_REGION_ID;
        region.className = 'visually-hidden';
        region.setAttribute('role', 'status');
        region.setAttribute('aria-live', 'polite');
        region.setAttribute('aria-atomic', 'true');
        root.appendChild(region);
    }
    return /** @type {HTMLElement} */ (region);
}

export function removeLiveRegion() {
    api.settings.get('root')?.querySelector(`#${LIVE_REGION_ID}`)?.remove();
}

/**
 * Reads out the passed in text to screen reader users.
 * @param {string} text
 */
export function announce(text) {
    const region = getLiveRegion();
    if (!region) return;

    // Clear first, so that repeating the same text is announced again
    region.textContent = '';
    setTimeout(() => (region.textContent = text), 100);
}
