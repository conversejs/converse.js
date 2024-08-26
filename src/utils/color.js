/**
 * @typedef {import('lit').TemplateResult} TemplateResult
 * @typedef {import('shared/chat/message').default} Message
 */
import { html } from 'lit';
import { until } from 'lit/directives/until.js';
import { api } from '@converse/headless';


/**
 * @param {string} color
 * @param {string} append_style
 */
function getCSS(color, append_style = '') {
    return `color: ${color}!important;${append_style}`;
}

/**
 * @returns {string|TemplateResult}
 */
export function getAuthorStyle(occupant) {
    if (api.settings.get('colorize_username')) {
        const color = occupant?.get('color');
        if (color) {
            return getCSS(color);
        } else {
            return occupant ? html`${until(occupant?.getColor().then(getCSS), '')}` : '';
        }
    }
}
