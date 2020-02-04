import { html } from "lit-html";
import { component, useState } from 'haunted';


export let setNotification;

function ChatNotifications () {
    const [notification, _setNotification] = useState('');
    setNotification = _setNotification;

    return html`
        <div class="notifications">${notification}</div>
    `;
}

customElements.define('converse-chat-notification', component(ChatNotifications));
