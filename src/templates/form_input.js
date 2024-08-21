import { html } from "lit";

export default  (o) => html`
    <div class="pb-2">
        ${ o.type !== 'hidden' ? html`<label for="${o.id}" class="form-label">${o.label}
            ${(o.desc) ? html`<small class="form-text text-muted">${o.desc}</small>` : ''}
        </label>` : '' }
        <!-- This is a hack to prevent Chrome from auto-filling the username in
             any of the other input fields in the MUC configuration form. -->
        ${ (o.type === 'password' && o.fixed_username) ? html`
            <input class="hidden-username" aria-hidden="true" type="text"
                autocomplete="username" value="${o.fixed_username}"></input>
        ` : '' }
        <input
            autocomplete="${o.autocomplete || ''}"
            class="form-control"
            id="${o.id}"
            name="${o.name}"
            placeholder="${o.placeholder || ''}"
            type="${o.type}"
            value="${o.value || ''}"
            ?readonly=${o.readonly}
            ?required=${o.required} />
    </div>`;
