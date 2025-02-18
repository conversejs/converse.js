import { html } from "lit";

export default (o) => html`
    <div class="mb-3">
        <label for="${o.id}" class="form-label">${o.label}
            ${ o.desc ? html`<small id="o.id" class="form-text text-muted">${o.desc}</small>` : '' }
        </label>
        <div>
            <a class="form-url" target="_blank" rel="noopener" id="${o.id}" href="${o.value}">${o.value}</a>
        </div>
    </div>`;

