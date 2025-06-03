import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { _converse, api, constants } from '@converse/headless';

const { CONTROLBOX_TYPE, CHATROOMS_TYPE, HEADLINES_TYPE, CONNECTION_STATUS } = constants;

function shouldShowChat(c) {
    const is_minimized = api.settings.get('view_mode') === 'overlayed' && c.get('hidden');
    return c.get('type') === CONTROLBOX_TYPE || !(c.get('hidden') || is_minimized);
}

export default () => {
    const { chatboxes, connfeedback } = _converse.state;
    const view_mode = api.settings.get('view_mode');
    const connection = api.connection.get();
    const logged_out = !connection?.connected || !connection?.authenticated || connection?.disconnecting;
    const connection_status = connfeedback.get('connection_status');
    const connecting = ['CONNECTED', 'CONNECTING', 'AUTHENTICATING', 'RECONNECTING'].includes(
        CONNECTION_STATUS[connection_status]
    );

    return html`
        ${!logged_out && view_mode === 'overlayed'
            ? html`<converse-minimized-chats class="col-auto"></converse-minimized-chats>`
            : ''}
        ${repeat(
            chatboxes.filter(shouldShowChat),
            (m) => m.get('jid'),
            (m) => {
                if (m.get('type') === CONTROLBOX_TYPE) {
                    return html`
                        ${view_mode === 'overlayed'
                            ? html`<converse-controlbox-toggle
                                  class="${!m.get('closed') ? 'hidden' : 'col-auto'}"
                              ></converse-controlbox-toggle>`
                            : ''}
                        <converse-controlbox
                            id="controlbox"
                            class="col-auto chatbox ${view_mode === 'overlayed' && m.get('closed')
                                ? 'hidden'
                                : ''} ${logged_out && !connecting ? 'logged-out' : ''}"
                            style="${m.get('width') ? `width: ${m.get('width')}` : ''}"
                        ></converse-controlbox>
                    `;
                } else if (m.get('type') === CHATROOMS_TYPE) {
                    return html`
                        <converse-muc jid="${m.get('jid')}" class="col-auto chatbox chatroom"></converse-muc>
                    `;
                } else if (m.get('type') === HEADLINES_TYPE) {
                    return html`
                        <converse-headlines
                            jid="${m.get('jid')}"
                            class="col-auto chatbox headlines"
                        ></converse-headlines>
                    `;
                } else {
                    return html`<converse-chat jid="${m.get('jid')}" class="col-auto chatbox"></converse-chat> `;
                }
            }
        )}
    `;
};
