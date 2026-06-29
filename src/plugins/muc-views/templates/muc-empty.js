import { html } from 'lit';
import { __ } from 'i18n';

/**
 * Default empty-state shown inside a MUC the user has entered which has no messages yet.
 */
export default () => html`<div class="muc-empty"><p class="muc-empty__heading">${__('No messages yet')}</p></div>`;
