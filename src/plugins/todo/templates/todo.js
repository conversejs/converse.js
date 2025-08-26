import { html, nothing } from 'lit';
import { _converse, api, constants } from '@converse/headless';
import { isMobileViewport } from 'shared/chat/utils';

const { CONTROLBOX_TYPE, CONNECTION_STATUS } = constants;

export default () => {
    const { chatboxes, connfeedback } = _converse.state;
    const view_mode = api.settings.get('view_mode');
    const is_overlayed = view_mode === 'overlayed';
    const is_mobile = isMobileViewport();
    const connection = api.connection.get();
    const logged_out = !connection?.connected || !connection?.authenticated || connection?.disconnecting;
    const connection_status = connfeedback.get('connection_status');
    const controlbox = chatboxes.find((m) => m.get('type') === CONTROLBOX_TYPE);
    const width = controlbox.get('width');
    const style = !is_mobile && is_overlayed && width ? `width: ${width}px` : nothing;
    const connecting = ['CONNECTED', 'CONNECTING', 'AUTHENTICATING', 'RECONNECTING'].includes(
        CONNECTION_STATUS[connection_status]
    );

    return html`
        ${!logged_out && is_overlayed
            ? html`<converse-minimized-chats class="col-auto"></converse-minimized-chats>`
            : ''}
        ${is_overlayed && controlbox.get('closed')
            ? html`<converse-controlbox-toggle class="col-auto"></converse-controlbox-toggle>`
            : html`<converse-controlbox
                  id="controlbox"
                  class="col-auto chatbox ${logged_out && !connecting ? 'logged-out' : ''}"
                  style="${style}"
              ></converse-controlbox>`}
    `;
};
