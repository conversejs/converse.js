import { html } from "lit";

export default  (o) => html`
    <div class="mb-3">
        <label for="${o.id}" class="form-label">${o.label}
            ${(o.desc) ? html`<small class="form-text text-muted">${o.desc}</small>` : ''}
        </label>
        <input
            class="form-control"
            id="${o.id}"
            name="${o.name}"
            type="datetime-local"
            value="${o.value || ''}"
            ?readonly=${o.readonly}
            ?required=${o.required} />
    </div>`;
