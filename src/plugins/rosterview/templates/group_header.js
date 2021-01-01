import { html } from "lit-html";
import { _converse } from "@converse/headless/core";

export default  (o) => html`
    <a href="#" class="list-toggle group-toggle controlbox-padded" title="${o.desc_group_toggle}">
        <span class="fa ${ (o.toggle_state === _converse.OPENED) ? 'fa-caret-down' : 'fa-caret-right' }">
        </span> ${o.label_group}</a>
    <ul class="items-list roster-group-contacts ${ (o.toggle_state === _converse.CLOSED) ? 'collapsed' : '' }"></ul>
`;
