import { __ } from 'i18n';
import { html } from "lit";


export const modal_close_button =
    html`<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${__('Close')}</button>`;

export const modal_header_close_button =
    html`<button type="button" class="btn btn-close d-flex align-items-center justify-content-center" data-bs-dismiss="modal" aria-label="${__('Close')}">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 16 16">
            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
        </svg>
    </button>`;
