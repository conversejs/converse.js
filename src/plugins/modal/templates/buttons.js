import { html } from 'lit';
import { __ } from 'i18n';

export const modal_close_button = html`<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
    ${__('Close')}
</button>`;

export const modal_header_close_button = html`<button
    type="button"
    class="btn d-flex align-items-center justify-content-center"
    data-bs-dismiss="modal"
    aria-label="${__('Close')}"
>
    <converse-icon size="1.25em" class="fa fa-times"></converse-icon>
</button>`;
