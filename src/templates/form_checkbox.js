import { html } from "lit";

export default  (o) => html`
    <fieldset class="pb-2">
        <input id="${o.id}"
               name="${o.name}"
               type="checkbox"
               ?readonly=${o.readonly}
               ?checked=${o.checked}
               ?required=${o.required} />
        <label class="form-check-label" for="${o.id}">${o.label}</label>
    </fieldset>`;
