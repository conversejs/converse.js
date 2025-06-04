import { html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { _converse, api, constants } from '@converse/headless';
import { isMobileViewport } from 'shared/chat/utils';

const { CONTROLBOX_TYPE, CHATROOMS_TYPE, HEADLINES_TYPE, CONNECTION_STATUS } = constants;

/**
 * @param {import('@converse/headless/types/shared/chatbox').default} c
 */
function shouldShowChat(c) {
    const is_minimized = api.settings.get('view_mode') === 'overlayed' && c.get('hidden');
    return c.get('type') === CONTROLBOX_TYPE || (!c.get('hidden') && !c.get('closed') && !is_minimized);
}

export default () => {
    const { chatboxes, connfeedback } = _converse.state;
    const view_mode = api.settings.get('view_mode');
    const is_overlayed = view_mode === 'overlayed';
    const is_mobile = isMobileViewport();
    const connection = api.connection.get();
    const logged_out = !connection?.connected || !connection?.authenticated || connection?.disconnecting;
    const connection_status = connfeedback.get('connection_status');
    const connecting = ['CONNECTED', 'CONNECTING', 'AUTHENTICATING', 'RECONNECTING'].includes(
        CONNECTION_STATUS[connection_status]
    );
    return html`
        ${!logged_out && is_overlayed
            ? html`<converse-minimized-chats class="col-auto"></converse-minimized-chats>`
            : ''}
        ${repeat(
            chatboxes.filter(shouldShowChat),
            (m) => m.get('jid'),
            (m) => {
                const width = m.get('width');
                const style = !is_mobile && is_overlayed && width ? `width: ${width}px` : nothing;
                if (m.get('type') === CONTROLBOX_TYPE) {
                    return is_overlayed && m.get('closed')
                        ? html`<converse-controlbox-toggle class="col-auto"></converse-controlbox-toggle>`
                        : html`<converse-controlbox
                              id="controlbox"
                              class="col-auto chatbox ${logged_out && !connecting ? 'logged-out' : ''}"
                              style="${style}"
                          ></converse-controlbox>`;
                } else if (m.get('type') === CHATROOMS_TYPE) {
                    return html`
                        <converse-muc
                            jid="${m.get('jid')}"
                            class="col-auto chatbox chatroom"
                            style="${style}"
                        ></converse-muc>
                    `;
                } else if (m.get('type') === HEADLINES_TYPE) {
                    return html`
                        <converse-headlines
                            jid="${m.get('jid')}"
                            class="col-auto chatbox headlines"
                            style="${style}"
                        ></converse-headlines>
                    `;
                } else {
                    return html`<converse-chat
                        jid="${m.get('jid')}"
                        class="col-auto chatbox"
                        style="${style}"
                    ></converse-chat> `;
                }
            }
        )}
    `;
};
