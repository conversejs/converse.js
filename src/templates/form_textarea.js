import { html } from "lit";
import u from '@converse/headless/utils/core.js';

export default  (o) => {
    const id = u.getUniqueId();
    return html`
        <div class="form-group">
            <label class="label-ta" for="${id}">${o.label}</label>
            <textarea name="${o.name}" id="${id}" class="form-control">${o.value}</textarea>
        </div>
    `;
};
