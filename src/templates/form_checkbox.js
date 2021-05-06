import { html } from "lit";

export default  (o) => html`
    <fieldset class="form-group">
        <input id="${o.id}" name="${o.name}" type="checkbox" ?checked=${o.checked} ?required=${o.required} />
        <label class="form-check-label" for="${o.id}">${o.label}</label>
    </fieldset>`;
