import { html } from "lit";

export default  (o) => html`
    <div class="form-group">
        ${ o.type !== 'hidden' ? html`<label for="${o.id}">${o.label}</label>` : '' }

        <!-- This is a hack to prevent Chrome from auto-filling the username in
             any of the other input fields in the MUC configuration form. -->
        ${ (o.type === 'password' && o.fixed_username) ? html`
            <input class="hidden-username" type="text" autocomplete="username" value="${o.fixed_username}"></input>
        ` : '' }

        <input
            autocomplete="${o.autocomplete || ''}"
            class="form-control"
            id="${o.id}"
            name="${o.name}"
            placeholder="${o.placeholder || ''}"
            type="${o.type}"
            value="${o.value || ''}"
            ?required=${o.required} />
    </div>`;
