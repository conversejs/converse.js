import { html } from "lit-html";
import { __ } from '../i18n';


const tpl_field = (f) => html`
    <div class="form-group">
        <label>
            ${f.label || ''}
            <input type="text"
                name="${f.name}"
                class="${(f.challenge_failed) ? 'error' : ''} form-control form-control--labeled"
                ?required="${f.required}"
                placeholder="${f.placeholder}" />
        </label>
    </div>
`;


export default (o) => html`
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header ${o.level || ''}">
          <h5 class="modal-title">${o.title}</h5>
          <button type="button" class="close" data-dismiss="modal" aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div class="modal-body">
            <span class="modal-alert"></span>
            <form class="converse-form converse-form--modal confirm" action="#">
              <div class="form-group">
                  ${ o.messages.map(message => html`<p>${message}</p>`) }
              </div>
              ${ o.fields.map(f => tpl_field(f)) }
              <div class="form-group">
                  <button type="submit" class="btn btn-primary">${__('OK')}</button>
                  <input type="button" class="btn btn-secondary" data-dismiss="modal" value="${__('Cancel')}"/>
              </div>
          </form>
        </div>
      </div>
    </div>
`;
