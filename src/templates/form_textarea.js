import { html } from "lit";
import { u } from '@converse/headless';

export default (o) => {
    const id = u.getUniqueId();
    return html`
        <div class="mb-3">
            <label class="form-label label-ta" for="${o.id}">${o.label}
                ${(o.desc) ? html`<small class="form-text text-muted">${o.desc}</small>` : ''}
            </label>
            <textarea name="${o.name}"
                      id="${id}"
                      ?readonly=${o.readonly}
                      ?required=${o.required}
                      class="form-control">${o.value}</textarea>
        </div>
    `;
};
