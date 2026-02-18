import { html } from "lit";
import { u } from '@converse/headless';

export default (o) => {
    const id = u.getUniqueId();
    return html`
        <div class="mb-3">
            <table class="table" name="${o.name}" id="${o.id}" data-var="${o.var}">
                <thead class="thead-light">
                    <th scope="col">
                        ${o.label}
                        ${(o.desc) ? html`<small class="form-text text-muted">${o.desc}</small>` : ''}
                    </th>
                </thead>
                <tbody>
                    ${o.values?.map(
                        (value) => html`<tr><td>${value}</td></tr>`
                    )}
                </tbody>
            </table>
        </div>
    `;
};

