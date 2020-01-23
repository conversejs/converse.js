import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';


const i18n_cancel = __('Cancel');
const i18n_ok = __('OK');


export default (o) => html`
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header ${o.level}">
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
              {[ if (o.type === 'prompt') { ]}
                <div class="form-group">
                    <input type="text" name="reason" class="form-control" placeholder="${o.placeholder}"/>
                </div>
              {[ } ]}
              <div class="form-group">
                  <button type="submit" class="btn btn-primary">${i18n_ok}</button>
                  <input type="button" class="btn btn-secondary" data-dismiss="modal" value="${i18n_cancel}"/>
              </div>
          </form>
        </div>
      </div>
    </div>
`;
