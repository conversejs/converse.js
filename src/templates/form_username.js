import { html } from "lit";

export default  (o) => html`
    <div class="form-group">
        ${ o.label ? html`<label>${o.label}</label>` :  '' }
        <div class="input-group">
                <input name="${o.name}"
                       class="form-control"
                       type="${o.type}"
                       value="${o.value || ''}"
                       ?required="${o.required}" />
            <div class="input-group-append">
                <div class="input-group-text" title="${o.domain}">${o.domain}</div>
            </div>
        </div>
    </div>`;
