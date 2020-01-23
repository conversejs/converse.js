import { __ } from '@converse/headless/i18n';
import { html } from "lit-html";

const i18n_close = __('Close');

export const modal_close_button = html`<button type="button" class="btn btn-secondary" data-dismiss="modal">${i18n_close}</button>`;

export const modal_header_close_button = html`<button type="button" class="close" data-dismiss="modal" aria-label="${i18n_close}"><span aria-hidden="true">×</span></button>`;

