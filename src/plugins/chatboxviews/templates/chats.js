import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { _converse, api } from '@converse/headless/core';


function shouldShowChat (c) {
    const { CONTROLBOX_TYPE } = _converse;
    const is_minimized = (api.settings.get('view_mode') === 'overlayed' && c.get('minimized'));
    return c.get('type') === CONTROLBOX_TYPE || !(c.get('hidden') || is_minimized);
}


export default () => {
    const { chatboxes, CONTROLBOX_TYPE, CHATROOMS_TYPE, HEADLINES_TYPE } = _converse;
    const view_mode = api.settings.get('view_mode');
    const connection = _converse?.connection;
    const logged_out = !connection?.connected || !connection?.authenticated || connection?.disconnecting;
    return html`
        ${!logged_out && view_mode === 'overlayed' ? html`<converse-minimized-chats></converse-minimized-chats>` : ''}
        ${repeat(chatboxes.filter(shouldShowChat), m => m.get('jid'), m => {
            if (m.get('type') === CONTROLBOX_TYPE) {
                return html`
                    ${view_mode === 'overlayed' ? html`<converse-controlbox-toggle class="${!m.get('closed') ? 'hidden' : ''}"></converse-controlbox-toggle>` : ''}
                    <converse-controlbox
                        id="controlbox"
                        class="chatbox ${view_mode === 'overlayed' && m.get('closed') ? 'hidden' : ''} ${logged_out ? 'logged-out': ''}"
                        style="${m.get('width') ? `width: ${m.get('width')}` : ''}"></converse-controlbox>
                `;
            } else if (m.get('type') === CHATROOMS_TYPE) {
                return html`
                    <converse-muc jid="${m.get('jid')}" class="chatbox chatroom"></converse-muc>
                `;
            } else if (m.get('type') === HEADLINES_TYPE) {
                return html`
                    <converse-headlines jid="${m.get('jid')}" class="chatbox headlines"></converse-headlines>
                `;
            } else {
                return html`
                    <converse-chat jid="${m.get('jid')}" class="chatbox"></converse-chat>
                `;
            }
        })}
    `;
};
