import { __ } from 'i18n';
import { html } from 'lit';


export default (o) => {
    const unread_msgs = __('You have unread messages');
    return html`
        ${ o.model.ui.get('scrolled') && o.model.get('num_unread') ?
            html`<div class="new-msgs-indicator" @click=${ev => o.viewUnreadMessages(ev)}>▼ ${ unread_msgs } ▼</div>` : '' }
        <converse-message-form .model=${o.model}></converse-message-form>
    `;
}
