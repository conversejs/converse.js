import { html } from 'lit-html';
import { _converse } from '@converse/headless/core';

export default () => {
    const { chatboxes, CONTROLBOX_TYPE, CHATROOMS_TYPE } = _converse;
    return html`
        <converse-minimized-chats></converse-minimized-chats>
        ${chatboxes.map(m => {
            if (m.get('type') === CONTROLBOX_TYPE) {
                return html`
                    <converse-controlbox-toggle class="${!m.get('closed') ? 'hidden' : ''}"></converse-controlbox-toggle>
                    <converse-controlbox
                        id="controlbox"
                        class="chatbox ${m.get('closed') ? 'hidden' : ''}"
                        style="${m.get('width') ? `width: ${m.get('width')}` : ''}"></converse-controlbox>
                `;
            } else if (m.get('type') === CHATROOMS_TYPE) {
                return html`
                    <converse-muc jid="${m.get('jid')}" class="chatbox ${(m.get('hidden') || m.get('minimized')) ? 'hidden' : ''}"></converse-muc>
                `;
            } else {
                return html`
                    <converse-chat jid="${m.get('jid')}" class="chatbox ${(m.get('hidden') || m.get('minimized')) ? 'hidden' : ''}"></converse-chat>
                `;
            }
        })}
    `;
};
