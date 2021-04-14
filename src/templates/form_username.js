import { html } from "lit";

export default  (o) => html`
    <div class="form-group">
        ${ o.label ? html`<label>${o.label}</label>` :  '' }
        <div class="input-group">
            <div class="input-group-prepend">
                <input name="${o.name}"
                       type="${o.type}"
                       value="${o.value || ''}"
                       ?required="${o.required}" />
                <div class="input-group-text col" title="${o.domain}">${o.domain}</div>
            </div>
        </div>
    </div>`;
