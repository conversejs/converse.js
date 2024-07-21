import { html } from "lit";

const tplOption = (o) => html`<option value="${o.value}" ?selected="${o.selected}">${o.label}</option>`;

export default  (o) => html`
    <div class="pb-2">
        <label for="${o.id}" class="form-label">${o.label}</label>
        <select class="form-control" id="${o.id}" name="${o.name}" ?multiple="${o.multiple}">
            ${o.options?.map(o => tplOption(o))}
        </select>
    </div>`;
