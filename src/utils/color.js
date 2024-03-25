/**
 * @typedef {import('lit').TemplateResult} TemplateResult
 * @typedef {import('shared/chat/message').default} Message
 * @typedef {import('@converse/headless/types/plugins/muc/occupant').default} MUCOccupant
 */
import { html } from "lit";
import { until } from 'lit/directives/until.js';
import { api } from '@converse/headless';

/** @param {string} color */
function getStyle (color) {
    return `color: ${color}!important;`;
}

/**
 * @param {MUCOccupant} occupant
 * @returns {string|TemplateResult}
 */
export function getAuthorStyle (occupant) {
    if (api.settings.get('colorize_username')) {
        const color = occupant?.get('color');
        if (color) {
            return getStyle(color);
        } else {
            return occupant ? html`${until(occupant?.getColor().then(getStyle), '')}` : '';
        }
    }
}
