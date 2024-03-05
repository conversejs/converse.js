import { __ } from 'i18n';
import { html } from "lit";


export const modal_close_button =
    html`<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${__('Close')}</button>`;

export const modal_header_close_button =
    html`<button type="button" class="btn btn-close" data-bs-dismiss="modal" aria-label="${__('Close')}"></button>`;
