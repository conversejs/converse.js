import { html } from "lit-html";
import { api } from "@converse/headless/core";

export default  (o) => html`
    <div class="d-flex controlbox-padded">
        <span class="w-100 controlbox-heading controlbox-heading--contacts">${o.heading_contacts}</span>
        <a class="controlbox-heading__btn sync-contacts fa fa-sync" title="${o.title_sync_contacts}"></a>
        ${ api.settings.get('allow_contact_requests') ? html`
            <a class="controlbox-heading__btn add-contact fa fa-user-plus"
               title="${o.title_add_contact}"
               data-toggle="modal"
               data-target="#add-contact-modal"></a>` : '' }
    </div>
    <converse-roster-filter></converse-roster-filter>
    <div class="list-container roster-contacts"></div>
`;
