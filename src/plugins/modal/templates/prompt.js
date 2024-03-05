import { html } from "lit";
import { __ } from 'i18n';


const tplField = (f) => html`
    <div>
        <label class="form-label">
            ${f.label || ''}
            <input type="text"
                name="${f.name}"
                class="${(f.challenge_failed) ? 'error' : ''} form-control form-control--labeled"
                ?required="${f.required}"
                placeholder="${f.placeholder}" />
        </label>
    </div>
`;

/**
 * @param {import('../confirm').default} el
 */
export default (el) => {
    return html`
        <form class="converse-form converse-form--modal confirm" action="#" @submit=${ev => el.onConfimation(ev)}>
            <div>
                ${ el.model.get('messages')?.map(message => html`<p>${message}</p>`) }
            </div>
            ${ el.model.get('fields')?.map(f => tplField(f)) }
            <div>
                <button type="submit" class="btn btn-primary">${__('OK')}</button>
                <input type="button" class="btn btn-secondary" data-bs-dismiss="modal" value="${__('Cancel')}"/>
            </div>
        </form>`;
}
