import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';

const i18n_save = __('Save');
const i18n_cancel = __('Cancel');

export default (o) => html`
    <form class="converse-form chatroom-form" autocomplete="off" @submit=${o.submitConfigForm}>
        <fieldset class="form-group">
            <legend>${o.title}</legend>
            ${ (o.title !== o.instructions) ? html`<p class="form-help">${o.instructions}</p>` : '' }
            <!-- Fields are generated internally, with xForm2webForm -->
            ${ o.fields.map(field =>  unsafeHTML(field)) }
        </fieldset>
        <fieldset>
            <input type="submit" class="btn btn-primary" value="${i18n_save}">
            <input type="button" class="btn btn-secondary button-cancel" value="${i18n_cancel}" @click=${o.closeConfigForm}>
        </fieldset>
    </form>
`;
