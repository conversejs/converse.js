import { __ } from 'i18n';
import { html } from "lit";


export const modal_close_button =
    html`<button type="button" class="btn btn-secondary" data-dismiss="modal">${__('Close')}</button>`;

export const modal_header_close_button =
    html`<button type="button" class="close" data-dismiss="modal" aria-label="${__('Close')}"><span aria-hidden="true">×</span></button>`;
