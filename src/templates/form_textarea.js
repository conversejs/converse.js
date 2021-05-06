import { html } from "lit";

export default  (o) => html`
    <label class="label-ta">${o.label}</label>
    <textarea name="${o.name}">${o.value}</textarea>
`;
