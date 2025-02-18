import { html } from "lit";

export default  (o) => html`
    <fieldset class="mb-3 form-check">
        <input id="${o.id}"
               name="${o.name}"
               type="checkbox"
               class="form-check-input"
               ?readonly=${o.readonly}
               ?checked=${o.checked}
               ?required=${o.required} />
        <label class="form-check-label" for="${o.id}">
            ${o.label}
            ${(o.desc) ? html`<small class="form-text text-muted">${o.desc}</small>` : ''}
        </label>
    </fieldset>`;
