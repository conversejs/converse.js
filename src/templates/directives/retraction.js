import { directive, html } from "lit-html";
import { __ } from '@converse/headless/i18n';


const i18n_retract_message = __('Retract this message');
const tpl_retract = (o) => html`
    <button class="chat-msg__action chat-msg__action-retract" title="${i18n_retract_message}" @click=${o.onMessageRetractButtonClicked}>
        <fa-icon class="fas fa-trash-alt" path-prefix="/dist" color="var(--text-color-lighten-15-percent)" size="1em"></fa-icon>
    </button>
`;


export const renderRetractionLink = directive(o => async part => {
    const may_be_moderated = o.model.get('type') === 'groupchat' && await o.model.mayBeModerated();
    const retractable = !o.is_retracted && (o.model.mayBeRetracted() || may_be_moderated);

    if (retractable) {
        part.setValue(tpl_retract(o));
    } else {
        part.setValue('');
    }
    part.commit();
});
