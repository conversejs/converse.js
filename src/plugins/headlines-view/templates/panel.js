import { html } from "lit-html";
import tpl_headline_list from "templates/headline_list.js";


export default (o) => html`
    <div class="d-flex controlbox-padded ${ o.headlineboxes.length ? '' : 'hidden' }">
        <span class="w-100 controlbox-heading controlbox-heading--headline">${o.heading_headline}</span>
    </div>
    ${ tpl_headline_list(o) }
`;
