import { html } from 'lit';

export default (o) => html`
    <div class="mb-3">
        ${
            o.type !== 'hidden'
                ? html`<label for="${o.id}" class="form-label"
                      >${o.label} ${o.desc ? html`<small class="form-text text-muted">${o.desc}</small>` : ''}
                  </label>`
                : ''
        }
        <div class="input-group">
                <input name="${o.name}"
                       class="form-control"
                       id="${o.id}"
                       type="${o.type}"
                       value="${o.value || ''}"
                       ?readonly=${o.readonly}
                       ?required=${o.required} />
                ${
                    o.domain
                        ? html`<div class="input-group-append">
                              <div class="input-group-text" title="${o.domain}">${o.domain}</div>
                          </div>`
                        : ''
                }
            </div>
        </div>
    </div>`;
