import { html } from "lit";

export default (o) => html`
    <fieldset class="mb-3">
        ${o.label ? html`<label class="form-label">${o.label}</label>` : '' }
        <img src="data:${o.type};base64,${o.data}">
        <input name="${o.name}" type="text" ?required="${o.required}" />
    </fieldset>
`;
