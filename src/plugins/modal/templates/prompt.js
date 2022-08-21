import { html } from "lit";
import { __ } from 'i18n';


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

export default (el) => {
    return html`
        <form class="converse-form converse-form--modal confirm" action="#" @submit=${ev => el.onConfimation(ev)}>
            <div class="form-group">
                ${ el.model.get('messages')?.map(message => html`<p>${message}</p>`) }
            </div>
            ${ el.model.get('fields')?.map(f => tpl_field(f)) }
            <div class="form-group">
                <button type="submit" class="btn btn-primary">${__('OK')}</button>
                <input type="button" class="btn btn-secondary" data-dismiss="modal" value="${__('Cancel')}"/>
            </div>
        </form>`;
}
